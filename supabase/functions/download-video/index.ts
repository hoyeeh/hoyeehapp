import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Entitlement-checked offline download proxy.
// Body: { contentId: uuid, episodeId?: uuid }  Header: Range (optional, passed through)
// The server resolves the media URL itself; the client never supplies a URL.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-length, content-range, content-type, accept-ranges, etag",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (b: unknown, status: number) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Authorization required" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u, error: authErr } = await admin.auth.getUser(auth.slice(7));
    if (authErr || !u?.user) return json({ error: "Authentication failed" }, 401);
    const userId = u.user.id;

    const { data: allowed } = await admin.rpc("cast_rate_limit_hit", {
      _key: `dl:${userId}`, _max: 60, _window_seconds: 60,
    });
    if (allowed !== true) return json({ error: "Rate limit exceeded. Please try again later." }, 429);

    const body = await req.json().catch(() => ({}));
    const contentId = body?.contentId;
    const episodeId = body?.episodeId;
    if (typeof contentId !== "string" || !UUID_RE.test(contentId)) return json({ error: "contentId required" }, 400);
    if (episodeId != null && (typeof episodeId !== "string" || !UUID_RE.test(episodeId))) {
      return json({ error: "Invalid episodeId" }, 400);
    }

    const { data: content } = await admin.from("content")
      .select("id, video_url, is_premium, lifecycle_status").eq("id", contentId).maybeSingle();
    if (!content || content.lifecycle_status === "hidden") return json({ error: "Not found" }, 404);

    let videoUrl: string | null = content.video_url;
    let premium = !!content.is_premium;
    if (episodeId) {
      // The episode must belong to THIS title (episode -> season -> content);
      // otherwise a free title id could unlock an unrelated premium episode.
      const { data: ep } = await admin.from("episodes")
        .select("video_url, is_premium, season_id, seasons!inner(content_id)")
        .eq("id", episodeId).maybeSingle();
      const parent = (ep as { seasons?: { content_id?: string } } | null)?.seasons?.content_id;
      if (!ep || parent !== contentId) return json({ error: "Not found" }, 404);
      videoUrl = ep.video_url;
      premium = premium || !!ep.is_premium;
    }

    // Established download policy (same as before this change):
    //  - admins: allowed
    //  - paid titles: only buyers
    //  - premium titles: active subscribers
    //  - free titles: any signed-in user
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = !!roles?.some((r) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      const { data: paid, error: paidErr } = await admin.from("paid_content").select("id")
        .eq("content_id", contentId).eq("is_active", true).eq("is_free", false).limit(1);
      if (paidErr) return json({ error: "Entitlement check failed" }, 503);
      if (paid && paid.length > 0) {
        const { data: bought } = await admin.rpc("has_purchased_content", { _user_id: userId, _content_id: contentId });
        if (bought !== true) return json({ error: "Purchase required to download" }, 403);
      } else if (premium) {
        const { data: prof } = await admin.from("profiles").select("subscription_expiry").eq("id", userId).maybeSingle();
        const active = prof?.subscription_expiry && new Date(prof.subscription_expiry) > new Date();
        if (!active) return json({ error: "Active subscription required to download" }, 403);
      }
    }

    if (!videoUrl) return json({ error: "No downloadable file" }, 404);
    let parsed: URL;
    try { parsed = new URL(videoUrl); } catch { return json({ error: "No downloadable file" }, 404); }
    if (parsed.protocol !== "https:") return json({ error: "No downloadable file" }, 404);
    if (/\.m3u8$/i.test(parsed.pathname)) {
      return json({ error: "This title is streaming-only (HLS). An MP4 version is needed for offline viewing.", code: "HLS_UNSUPPORTED" }, 415);
    }

    const range = req.headers.get("range");
    const upstreamHeaders: Record<string, string> = {};
    if (range && /^bytes=\d+-\d*$/.test(range)) upstreamHeaders["Range"] = range;
    const upstream = await fetch(videoUrl, { headers: upstreamHeaders });
    if (!upstream.ok && upstream.status !== 206) {
      await upstream.body?.cancel();
      return json({ error: "Source unavailable" }, upstream.status === 416 ? 416 : 502);
    }
    const ct = upstream.headers.get("content-type") || "video/mp4";
    if (/mpegurl/i.test(ct)) {
      await upstream.body?.cancel();
      return json({ error: "Streaming-only source", code: "HLS_UNSUPPORTED" }, 415);
    }
    const h: Record<string, string> = { ...corsHeaders, "Content-Type": ct, "Cache-Control": "no-store" };
    for (const k of ["content-length", "content-range", "accept-ranges", "etag"]) {
      const v = upstream.headers.get(k);
      if (v) h[k] = v;
    }
    console.log("[download-video] ok", { userId, contentId, episodeId: episodeId ?? null, status: upstream.status });
    return new Response(upstream.body, { status: upstream.status, headers: h });
  } catch (e) {
    console.error("[download-video] error", e instanceof Error ? e.message : "unknown");
    return json({ error: "Internal error" }, 500);
  }
});
