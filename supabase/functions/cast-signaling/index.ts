import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generatePairingCode,
  generateReceiverSecret,
  sha256Hex,
  validateCommand,
  isSafeMediaUrl,
} from "./protocol.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cast-receiver-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getAuthUser(req: Request, supabase: any) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data?.user ?? null;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method !== "POST") return {};
  const text = await req.text();
  if (text.length > 64_000) throw new Error("PAYLOAD_TOO_LARGE");
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const clientIp =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";

  const rateOk = async (key: string, max: number, windowSec: number) => {
    const { data, error } = await supabase.rpc("cast_rate_limit_hit", {
      _key: key, _max: max, _window_seconds: windowSec,
    });
    if (error) {
      console.error("[cast-signaling] rate limit error", error.message);
      return false; // fail closed
    }
    return data === true;
  };

  // Resolve the receiver identity from the credential header.
  const loadReceiverSession = async (sessionId: unknown) => {
    const secret = req.headers.get("x-cast-receiver-secret") || "";
    if (typeof sessionId !== "string" || !UUID_RE.test(sessionId) || secret.length < 32 || secret.length > 128) {
      return null;
    }
    const hash = await sha256Hex(secret);
    const { data } = await supabase
      .from("cast_sessions")
      .select("*, cast_receivers(device_name, device_type)")
      .eq("id", sessionId)
      .eq("receiver_secret_hash", hash)
      .maybeSingle();
    return data ? { session: data, hash } : null;
  };

  try {
    let body: Record<string, unknown>;
    try {
      body = await readBody(req);
    } catch {
      return json({ success: false, error: "Payload too large" }, 413);
    }

    if (action === "health") {
      return json({ success: true, status: "ok", version: "2.0.0", timestamp: new Date().toISOString() });
    }

    // ---------------- Receiver: create pending session ----------------
    if (action === "generate-code") {
      if (!(await rateOk(`gen:ip:${clientIp}`, 30, 600))) {
        return json({ success: false, error: "Too many requests" }, 429);
      }
      const deviceName = typeof body.deviceName === "string" ? body.deviceName.slice(0, 60) : "Smart TV";
      const deviceType = body.deviceType === "screen_mirror" ? "screen_mirror" : "smart_tv";

      const { data: receiver, error: rErr } = await supabase
        .from("cast_receivers")
        .insert({ device_name: deviceName || "Smart TV", device_type: deviceType })
        .select("id")
        .single();
      if (rErr) throw rErr;

      const secret = generateReceiverSecret();
      const hash = await sha256Hex(secret);
      let session: any = null;
      for (let i = 0; i < 8 && !session; i++) {
        const { data, error } = await supabase
          .from("cast_sessions")
          .insert({
            pairing_code: generatePairingCode(),
            receiver_id: receiver.id,
            receiver_secret_hash: hash,
            status: "pending",
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          })
          .select("id, pairing_code, expires_at")
          .single();
        if (!error) session = data;
        else if (error.code !== "23505") throw error; // retry only on code collision
      }
      if (!session) throw new Error("Could not allocate pairing code");

      await supabase.from("cast_events").insert({
        session_id: session.id, actor: "system", event_type: "GENERATE_CODE", payload: { deviceType },
      });

      return json({
        success: true,
        pairingCode: session.pairing_code,
        sessionId: session.id,
        receiverId: receiver.id,
        receiverSecret: secret, // returned once, never stored in plaintext
        expiresAt: session.expires_at,
      });
    }

    // ---------------- Controller: pair (atomic claim) ----------------
    if (action === "pair") {
      const user = await getAuthUser(req, supabase);
      if (!user) return json({ success: false, error: "Authentication required" }, 401);
      if (!(await rateOk(`pair:ip:${clientIp}`, 10, 60)) || !(await rateOk(`pair:user:${user.id}`, 10, 60))) {
        return json({ success: false, error: "Too many attempts. Try again in a minute." }, 429);
      }
      const code = typeof body.pairingCode === "string" ? body.pairingCode.trim().toUpperCase() : "";
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
        return json({ success: false, error: "Invalid or expired pairing code" }, 400);
      }
      const { data, error } = await supabase.rpc("cast_claim_pairing", { _code: code, _user_id: user.id });
      if (error) throw error;
      const claimed = Array.isArray(data) ? data[0] : null;
      if (!claimed) return json({ success: false, error: "Invalid or expired pairing code" }, 400);

      await supabase.from("cast_events").insert({
        session_id: claimed.session_id, actor: "controller", event_type: "PAIR", payload: { userId: user.id },
      });
      return json({
        success: true,
        sessionId: claimed.session_id,
        receiverId: claimed.receiver_id,
        deviceName: claimed.device_name,
        deviceType: claimed.device_type,
      });
    }

    // ---------------- Controller: command ----------------
    if (action === "command") {
      const user = await getAuthUser(req, supabase);
      if (!user) return json({ success: false, error: "Authentication required" }, 401);
      const sessionId = body.sessionId;
      if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
        return json({ success: false, error: "Invalid sessionId" }, 400);
      }
      if (!(await rateOk(`cmd:${sessionId}`, 40, 10))) {
        return json({ success: false, error: "Too many commands. Please slow down." }, 429);
      }
      const v = validateCommand(body.command, body.payload);
      if (!v.ok) return json({ success: false, error: v.error }, 400);
      if (v.patch.video_url && !isSafeMediaUrl(String(v.patch.video_url))) {
        return json({ success: false, error: "Unsupported video URL" }, 400);
      }

      const { data: seq, error } = await supabase.rpc("cast_apply_command", {
        _session_id: sessionId, _user_id: user.id, _command: v.command, _patch: v.patch, _bump: v.bump,
      });
      if (error) throw error;
      if (seq === null || seq === undefined) {
        return json({ success: false, error: "Session not found, expired, or not yours" }, 403);
      }
      if (v.bump) {
        await supabase.from("cast_events").insert({
          session_id: sessionId, actor: "controller", event_type: "COMMAND",
          payload: { command: v.command, seq }, // never log media URLs
        });
      }
      return json({ success: true, command: v.command, sessionId, seq: Number(seq) });
    }

    // ---------------- Status (receiver credential OR owning controller) ----------------
    if (action === "status") {
      const sessionId = url.searchParams.get("sessionId") ?? body.sessionId;
      let session: any = null;
      let role: "receiver" | "controller" | null = null;

      const rec = await loadReceiverSession(sessionId);
      if (rec) { session = rec.session; role = "receiver"; }
      else {
        const user = await getAuthUser(req, supabase);
        if (!user) return json({ success: false, error: "Authentication required" }, 401);
        if (typeof sessionId !== "string" || !UUID_RE.test(sessionId)) {
          return json({ success: false, error: "Invalid sessionId" }, 400);
        }
        const { data } = await supabase
          .from("cast_sessions").select("*, cast_receivers(device_name, device_type)")
          .eq("id", sessionId).eq("controller_user_id", user.id).maybeSingle();
        if (!data) return json({ success: false, error: "Not authorized" }, 403);
        session = data; role = "controller";
      }

      let status = session.status;
      if (status !== "disconnected" && new Date(session.expires_at).getTime() < Date.now()) {
        status = "expired";
        await supabase.from("cast_sessions").update({ status: "disconnected", video_url: null }).eq("id", session.id);
      }
      const live = status === "paired" || status === "active";
      return json({
        success: true,
        role,
        session: {
          id: session.id,
          status,
          // Media URL only for a live, claimed session.
          videoUrl: live ? session.video_url : null,
          videoTitle: live ? session.video_title : null,
          videoThumbnail: live ? session.video_thumbnail : null,
          // Receiver gets the commanded position; controller gets what the TV reports.
          playbackTime: role === "receiver" ? session.playback_time : (session.receiver_playback_time ?? session.playback_time),
          duration: session.video_duration,
          isPlaying: role === "receiver" ? session.is_playing : (session.receiver_is_playing ?? session.is_playing),
          volume: session.volume_level,
          queue: live ? session.queue : [],
          deviceName: session.cast_receivers?.device_name,
          lastHeartbeat: session.last_heartbeat,
          expiresAt: session.expires_at,
          commandSeq: Number(session.command_seq || 0),
          commandType: session.command_type,
          commandPayload: live ? session.command_payload : null,
          lastAckedSeq: Number(session.last_acked_seq || 0),
          lastAckStatus: session.last_ack_status,
          lastAckError: session.last_ack_error,
          lastAckAt: session.last_ack_at,
        },
      });
    }

    // ---------------- Receiver heartbeat ----------------
    if (action === "heartbeat") {
      const rec = await loadReceiverSession(body.sessionId);
      if (!rec) return json({ success: false, error: "Invalid receiver credential" }, 401);
      const s = rec.session;
      if (!["pending", "paired", "active"].includes(s.status) || new Date(s.expires_at).getTime() < Date.now()) {
        return json({ success: false, error: "Session ended", status: s.status }, 410);
      }
      const update: Record<string, unknown> = { last_heartbeat: new Date().toISOString() };
      const t = Number(body.playbackTime);
      if (Number.isFinite(t) && t >= 0 && t < 86400 * 2) update.receiver_playback_time = t;
      if (typeof body.isPlaying === "boolean") update.receiver_is_playing = body.isPlaying;
      await supabase.from("cast_sessions").update(update).eq("id", s.id);
      return json({ success: true });
    }

    // ---------------- Receiver ACK ----------------
    if (action === "ack") {
      const rec = await loadReceiverSession(body.sessionId);
      if (!rec) return json({ success: false, error: "Invalid receiver credential" }, 401);
      const seq = body.seq;
      const status = body.status;
      if (typeof seq !== "number" || !Number.isInteger(seq) || seq < 1 || (status !== "success" && status !== "error")) {
        return json({ success: false, error: "Invalid ack" }, 400);
      }
      const err = typeof body.error === "string" ? body.error.slice(0, 500) : null;
      const { data: ok, error } = await supabase.rpc("cast_record_ack", {
        _session_id: rec.session.id, _secret_hash: rec.hash, _seq: seq, _status: status, _error: err,
      });
      if (error) throw error;
      if (!ok) return json({ success: false, error: "Stale or duplicate ack" }, 409);
      await supabase.from("cast_events").insert({
        session_id: rec.session.id, actor: "receiver",
        event_type: status === "success" ? "ACK" : "ACK_ERROR", payload: { seq, error: err },
      });
      return json({ success: true });
    }

    // ---------------- Disconnect (owner or credentialed receiver) ----------------
    if (action === "disconnect") {
      const rec = await loadReceiverSession(body.sessionId);
      let sessionId: string | null = rec?.session.id ?? null;
      if (!sessionId) {
        const user = await getAuthUser(req, supabase);
        if (!user || typeof body.sessionId !== "string" || !UUID_RE.test(body.sessionId)) {
          return json({ success: false, error: "Not authorized" }, 403);
        }
        const { data } = await supabase.from("cast_sessions").select("id")
          .eq("id", body.sessionId).eq("controller_user_id", user.id).maybeSingle();
        if (!data) return json({ success: false, error: "Not authorized" }, 403);
        sessionId = data.id;
      }
      await supabase.from("cast_sessions")
        .update({ status: "disconnected", video_url: null, is_playing: false }).eq("id", sessionId);
      return json({ success: true });
    }

    return json({ success: false, error: "Invalid action" }, 400);
  } catch (error) {
    console.error("[cast-signaling] Error:", error instanceof Error ? error.message : error);
    return json({ success: false, error: "Internal error" }, 500);
  }
});
