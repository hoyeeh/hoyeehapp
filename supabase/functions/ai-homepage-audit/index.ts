// AI Homepage Audit — daily cron. Snapshots home_sections, content, and
// engagement, asks Lovable AI for proposals, writes them to homepage_ai_suggestions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Suggestion {
  suggestion_type: "heal" | "new_section" | "reorder" | "content_swap";
  target_section_id?: string | null;
  proposed_payload: Record<string, unknown>;
  reason: string;
  priority?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("Missing LOVABLE_API_KEY");

    // 1. Snapshot sections
    const { data: sections, error: secErr } = await supabase
      .from("home_sections")
      .select("*")
      .order("display_order");
    if (secErr) throw secErr;

    // 2. Section content counts
    const { data: sectionContent } = await supabase
      .from("section_content")
      .select("section_id, content_id");
    const countsBySection: Record<string, number> = {};
    (sectionContent ?? []).forEach((r: any) => {
      countsBySection[r.section_id] = (countsBySection[r.section_id] ?? 0) + 1;
    });

    // 3. Genre catalog summary
    const { data: genres } = await supabase.from("genres").select("id,name");

    // 4. Trending genres (last 30d)
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: watch } = await supabase
      .from("watch_history")
      .select("content:content_id(genre)")
      .gte("watched_at", since)
      .limit(2000);
    const genreCounts: Record<string, number> = {};
    (watch ?? []).forEach((w: any) => {
      const g = w?.content?.genre;
      if (g) genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    });
    const trendingGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([g, c]) => ({ genre: g, views: c }));

    // 5. Heal: detect gap sections (curated only — auto sections fill themselves)
    const healHints: Suggestion[] = [];
    for (const s of sections ?? []) {
      const max = s.max_items ?? 20;
      const actual = countsBySection[s.id] ?? 0;
      if (s.is_curated && s.is_active && actual < Math.min(5, max)) {
        healHints.push({
          suggestion_type: "heal",
          target_section_id: s.id,
          proposed_payload: { issue: "low_content", actual, max_items: max },
          reason: `Curated section "${s.title}" has only ${actual} items (max ${max}). Add more content or hide section.`,
          priority: 8,
        });
      }
      if (!s.is_active) continue;
      if (!s.show_on_desktop && !s.show_on_mobile && !s.show_on_kids) {
        healHints.push({
          suggestion_type: "heal",
          target_section_id: s.id,
          proposed_payload: { issue: "no_surface" },
          reason: `Section "${s.title}" is active but hidden on every surface.`,
          priority: 6,
        });
      }
    }

    // 6. Ask AI for new sections + reorder
    const prompt = `You are a homepage curator for a Netflix-style streaming app.

Current sections (title | type | active | max_items | actual_items):
${(sections ?? []).map((s: any) => `- ${s.title} | ${s.section_type} | ${s.is_active} | ${s.max_items ?? "?"} | ${countsBySection[s.id] ?? 0}`).join("\n")}

Available genres: ${(genres ?? []).map((g: any) => g.name).join(", ")}

Trending genres (last 30d by views):
${trendingGenres.map((t) => `- ${t.genre}: ${t.views}`).join("\n") || "- (no data)"}

Propose up to 5 improvements as a strict JSON array. Each item:
{
  "suggestion_type": "new_section" | "reorder",
  "proposed_payload": { ... },
  "reason": "short admin-facing explanation",
  "priority": 1-10
}

For "new_section": payload = { title, section_type ('genre'|'trending'|'recently_added'|'top10'|'recommendations'|'continue_watching'), genre_name?, max_items (10-20), card_style ('full'|'poster'|'wide'), card_size ('sm'|'md'|'lg') }
For "reorder": payload = { ordered_titles: [exact existing section titles in desired top-to-bottom order] }

Only return the JSON array.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Return only valid JSON arrays." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
    }

    let aiSuggestions: Suggestion[] = [];
    try {
      const aiJson = await aiRes.json();
      const content = aiJson?.choices?.[0]?.message?.content ?? "";
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) aiSuggestions = parsed as Suggestion[];
      }
    } catch (e) {
      console.error("Failed to parse AI response", e);
    }

    // 7. Validate + insert
    const valid: any[] = [];
    for (const s of [...healHints, ...aiSuggestions]) {
      if (!s?.suggestion_type) continue;
      if (!["heal", "new_section", "reorder", "content_swap"].includes(s.suggestion_type)) continue;
      valid.push({
        suggestion_type: s.suggestion_type,
        target_section_id: s.target_section_id ?? null,
        proposed_payload: s.proposed_payload ?? {},
        reason: (s.reason ?? "").slice(0, 1000),
        priority: Math.max(1, Math.min(10, Number(s.priority) || 5)),
        status: "pending",
      });
    }

    // Expire stale pending suggestions
    await supabase
      .from("homepage_ai_suggestions")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    if (valid.length > 0) {
      const { error: insErr } = await supabase
        .from("homepage_ai_suggestions")
        .insert(valid);
      if (insErr) console.error("Insert error", insErr);
    }

    return new Response(
      JSON.stringify({ ok: true, inserted: valid.length, ai_count: aiSuggestions.length, heal_count: healHints.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-homepage-audit error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
