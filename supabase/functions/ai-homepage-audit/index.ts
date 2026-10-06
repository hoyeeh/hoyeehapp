// AI Homepage Audit — scheduled + on-demand.
// Snapshots home_sections, catalog, internal engagement AND real-world TMDB trends,
// asks Lovable AI for proposals, writes them to homepage_ai_suggestions and
// (when autopilot is on) applies high-confidence ones automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyHomepageSuggestion } from "../_shared/homepageSuggestions.ts";

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
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const bearer = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
    const isServiceCall = bearer && bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!isServiceCall) {
      if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (!(roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("Missing LOVABLE_API_KEY");

    // 0. Refresh external trends first (best effort — audit still runs on failure)
    try {
      const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tmdb-trends-sync`;
      await fetch(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: "{}",
      });
    } catch (e) {
      console.error("Trend sync failed (continuing)", e);
    }

    // 1. Snapshot sections
    const { data: sections, error: secErr } = await supabase
      .from("home_sections")
      .select("*")
      .eq("source", "manual")
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

    // 4. Trending genres internally (last 30d)
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

    // 5. External (TMDB) trends
    const { data: trends } = await supabase
      .from("external_trends")
      .select("title,media_type,genres,popularity,vote_average,trend_rank,trend_window,is_owned,content_id")
      .order("trend_rank")
      .limit(300);

    const ownedTrends = (trends ?? []).filter((t: any) => t.is_owned && t.content_id);
    // De-duplicate owned titles, keep the best rank
    const ownedByContent = new Map<string, any>();
    for (const t of ownedTrends) {
      const existing = ownedByContent.get(t.content_id);
      if (!existing || t.trend_rank < existing.trend_rank) ownedByContent.set(t.content_id, t);
    }
    const ownedList = [...ownedByContent.values()].sort((a, b) => a.trend_rank - b.trend_rank);

    const externalGenreCounts: Record<string, number> = {};
    (trends ?? []).forEach((t: any) => {
      (t.genres ?? []).forEach((g: string) => {
        externalGenreCounts[g] = (externalGenreCounts[g] ?? 0) + 1;
      });
    });
    const globalHotGenres = Object.entries(externalGenreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([g, c]) => ({ genre: g, titles: c }));

    // 6. Heal: detect gap sections (curated only — auto sections fill themselves)
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

    // 7. Deterministic trend-driven content swap for curated "trending"-style sections
    const trendSwaps: Suggestion[] = [];
    if (ownedList.length >= 5) {
      const trendingSection = (sections ?? []).find(
        (s: any) =>
          s.is_curated &&
          s.is_active &&
          /trend|popular|hot|worldwide/i.test(s.title ?? ""),
      );
      if (trendingSection) {
        const max = Math.max(1, Number(trendingSection.max_items) || 20);
        trendSwaps.push({
          suggestion_type: "content_swap",
          target_section_id: trendingSection.id,
          proposed_payload: {
            section_id: trendingSection.id,
            content_ids: ownedList.slice(0, max).map((t) => t.content_id),
            titles: ownedList.slice(0, max).map((t) => t.title),
            source: "tmdb_trending",
          },
          reason: `Refresh "${trendingSection.title}" with the ${Math.min(max, ownedList.length)} titles trending worldwide right now that we already have in the library.`,
          priority: 9,
        });
      }
    }

    // 8. Ask AI for content refresh advice only. The admin layout remains authoritative.
    const ownedForPrompt = ownedList.slice(0, 40).map(
      (t) => `- ${t.title} (${t.media_type}, rank ${t.trend_rank} in ${t.trend_window}, score ${t.vote_average}) id=${t.content_id}`,
    );

    const prompt = `You are a homepage content curator for a premium streaming app.

Current sections (title | type | active | max_items | actual_items):
${(sections ?? []).map((s: any) => `- ${s.title} | ${s.section_type} | ${s.is_active} | ${s.max_items ?? "?"} | ${countsBySection[s.id] ?? 0}`).join("\n")}

Available genres: ${(genres ?? []).map((g: any) => g.name).join(", ")}

Internal trending genres (last 30d by views):
${trendingGenres.map((t) => `- ${t.genre}: ${t.views}`).join("\n") || "- (no data)"}

Real-world trending genres right now (TMDB):
${globalHotGenres.map((t) => `- ${t.genre}: ${t.titles} trending titles`).join("\n") || "- (no data)"}

Titles trending worldwide THAT WE OWN (use only these content ids):
${ownedForPrompt.join("\n") || "- (none matched our catalog)"}

Propose at most 2 content refreshes as a strict JSON array. Each item:
{
  "suggestion_type": "content_swap",
  "target_section_id": "<uuid of an existing curated row>",
  "proposed_payload": { ... },
  "reason": "short admin-facing explanation",
  "priority": 1-10
}

For "content_swap": payload = { section_id, content_ids: [ids from the owned-trending list, best first] }

Rules: never invent content ids. Never change row titles, order, visibility, style, size, filters, max_items, or surface flags. Only target existing curated rows. Preserve the admin layout exactly.
Only return the JSON array.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        input: [{ role: "system", content: [{ type: "input_text", text: "Return only content refresh decisions grounded in the supplied catalogue." }] }, { role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: { format: { type: "json_schema", name: "homepage_content_refreshes", strict: true, schema: { type: "object", properties: { suggestions: { type: "array", maxItems: 2, items: { type: "object", properties: { suggestion_type: { type: "string", enum: ["content_swap"] }, target_section_id: { type: "string" }, proposed_payload: { type: "object", properties: { section_id: { type: "string" }, content_ids: { type: "array", items: { type: "string" } } }, required: ["section_id", "content_ids"], additionalProperties: false }, reason: { type: "string" }, priority: { type: "integer", minimum: 1, maximum: 10 } }, required: ["suggestion_type", "target_section_id", "proposed_payload", "reason", "priority"], additionalProperties: false } } }, required: ["suggestions"], additionalProperties: false } } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
    }

    let aiSuggestions: Suggestion[] = [];
    try {
      const aiJson = await aiRes.json();
       const content = aiJson?.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === "output_text")?.text ?? "";
       const parsed = JSON.parse(content);
       if (Array.isArray(parsed?.suggestions)) aiSuggestions = parsed.suggestions as Suggestion[];
    } catch (e) {
      console.error("Failed to parse AI response", e);
    }

    // 9. Validate + insert (AI may only reference content ids we own & sections that exist)
    const ownedIds = new Set(ownedList.map((t) => t.content_id));
    const sectionIds = new Set((sections ?? []).map((s: any) => s.id));

    // Layout hygiene: the homepage keeps exactly two Top 10 rows (Movies + Series),
    // and never two sections with the same name.
    const norm = (t: unknown) => String(t ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const existingTitles = new Set((sections ?? []).map((s: any) => norm(s.title)));
    const proposedTitles = new Set<string>();

    const valid: any[] = [];
    for (const s of [...healHints, ...trendSwaps, ...aiSuggestions]) {
      if (!s?.suggestion_type) continue;
      if (!["heal", "content_swap"].includes(s.suggestion_type)) continue;

      const payload: any = { ...(s.proposed_payload ?? {}) };

      if (Array.isArray(payload.content_ids)) {
        payload.content_ids = payload.content_ids.filter((id: string) => ownedIds.has(id));
      }
      if (s.suggestion_type === "content_swap") {
        const sectionId = s.target_section_id ?? payload.section_id;
        if (!sectionId || !sectionIds.has(sectionId)) continue;
        if (!Array.isArray(payload.content_ids) || payload.content_ids.length === 0) continue;
        payload.section_id = sectionId;
        s.target_section_id = sectionId;
      }

      valid.push({
        suggestion_type: s.suggestion_type,
        target_section_id: s.target_section_id ?? null,
        proposed_payload: payload,
        reason: (s.reason ?? "").slice(0, 1000),
        priority: Math.max(1, Math.min(10, Number(s.priority) || 5)),
        status: "pending",
      });
    }

    // Keep the board clean: only ever surface the TWO strongest suggestions,
    // de-duplicated by (type + target + payload signature).
    const seenSig = new Set<string>();
    const deduped = valid.filter((v) => {
      const sig = `${v.suggestion_type}|${v.target_section_id ?? ""}|${JSON.stringify(v.proposed_payload)}`;
      if (seenSig.has(sig)) return false;
      seenSig.add(sig);
      return true;
    });
    deduped.sort((a, b) => b.priority - a.priority);
    const shortlist = deduped.slice(0, 2).map((v, i) => ({ ...v, is_recommended: i === 0 }));

    // Retire every previous pending suggestion so the list never accumulates.
    await supabase
      .from("homepage_ai_suggestions")
      .update({ status: "expired" })
      .eq("status", "pending");

    let insertedRows: any[] = [];
    if (shortlist.length > 0) {
      const { data: ins, error: insErr } = await supabase
        .from("homepage_ai_suggestions")
        .insert(shortlist)
        .select("id,suggestion_type,priority,is_recommended");
      if (insErr) console.error("Insert error", insErr);
      else insertedRows = ins ?? [];
    }


    // 10. Autopilot — auto-apply high-confidence suggestions of allowed types
    let autoApplied = 0;
    const { data: settings } = await supabase
      .from("ai_homepage_settings")
      .select("*")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (settings?.autopilot_enabled) {
      const threshold = Number(settings.confidence_threshold ?? 8);
      const allowed: string[] = (settings.allowed_types ?? ["content_swap"]).filter((t: string) => t === "content_swap" || t === "heal");
      for (const row of insertedRows) {
        if (!allowed.includes(row.suggestion_type)) continue;
        if (Number(row.priority) < threshold) continue;
        try {
          await applyHomepageSuggestion(supabase, row.id, null, true);
          autoApplied++;
        } catch (e) {
          console.error("Autopilot apply failed", row.id, e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        inserted: shortlist.length,
        ai_count: aiSuggestions.length,
        heal_count: healHints.length,
        trend_swaps: trendSwaps.length,
        owned_trending: ownedList.length,
        auto_applied: autoApplied,
      }),
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
