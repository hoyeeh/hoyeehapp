// Applies an approved homepage suggestion to home_sections.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { suggestion_id } = await req.json();
    if (!suggestion_id) {
      return new Response(JSON.stringify({ error: "suggestion_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sug, error: sugErr } = await admin
      .from("homepage_ai_suggestions").select("*").eq("id", suggestion_id).single();
    if (sugErr || !sug) {
      return new Response(JSON.stringify({ error: "Suggestion not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (sug.status === "applied") {
      return new Response(JSON.stringify({ ok: true, already_applied: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = sug.proposed_payload ?? {};

    if (sug.suggestion_type === "new_section") {
      let genreId: string | null = null;
      if (payload.genre_name) {
        const { data: g } = await admin
          .from("genres").select("id").ilike("name", String(payload.genre_name)).maybeSingle();
        if (g) genreId = g.id;
      }
      const { data: maxOrder } = await admin
        .from("home_sections").select("display_order")
        .order("display_order", { ascending: false }).limit(1).maybeSingle();
      const nextOrder = ((maxOrder?.display_order as number | undefined) ?? 0) + 1;

      const { error: insErr } = await admin.from("home_sections").insert({
        title: String(payload.title ?? "New Section"),
        section_type: String(payload.section_type ?? "genre"),
        genre_id: genreId,
        card_style: String(payload.card_style ?? "full"),
        card_size: String(payload.card_size ?? "md"),
        max_items: Math.max(1, Math.min(50, Number(payload.max_items) || 15)),
        display_order: nextOrder,
        is_active: true,
        show_on_desktop: true,
        show_on_mobile: true,
        show_on_kids: false,
        is_curated: false,
        allow_duplicates: false,
      });
      if (insErr) throw insErr;
    } else if (sug.suggestion_type === "reorder") {
      const orderedTitles: string[] = Array.isArray(payload.ordered_titles) ? payload.ordered_titles : [];
      if (orderedTitles.length === 0) throw new Error("Empty reorder list");
      const { data: existing } = await admin.from("home_sections").select("id,title");
      const titleToId = new Map((existing ?? []).map((s: any) => [s.title, s.id]));
      let order = 1;
      for (const t of orderedTitles) {
        const id = titleToId.get(t);
        if (!id) continue;
        await admin.from("home_sections").update({ display_order: order++ }).eq("id", id);
      }
    } else if (sug.suggestion_type === "heal") {
      // For heal, admin reviews and acts manually; just mark applied.
      // (auto-hide could be added by reading payload.action)
      if (payload.action === "hide" && sug.target_section_id) {
        await admin.from("home_sections")
          .update({ is_active: false }).eq("id", sug.target_section_id);
      }
    }

    await admin.from("homepage_ai_suggestions").update({
      status: "applied",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      applied_at: new Date().toISOString(),
    }).eq("id", suggestion_id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("apply-homepage-suggestion error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
