// Lightweight ingestion endpoint for Smart TV telemetry.
//
// Smart TVs (Tizen, webOS, legacy WebKit) call this with `navigator.sendBeacon`
// or a fire-and-forget `fetch` at key checkpoints of the /tv → /tv-receiver
// flow: redirect_fired, receiver_boot, polyfills_ready, pairing_visible,
// pairing_failed, receiver_error. We persist every event so admins can audit
// failures in production.
//
// Public endpoint (verify_jwt = false). Inserts use service_role to bypass
// RLS, but only the typed columns are written — the body is never echoed
// back, so abuse surface is minimal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_EVENTS = new Set([
  "redirect_fired",
  "redirect_failed",
  "receiver_boot",
  "polyfills_ready",
  "pairing_visible",
  "pairing_failed",
  "receiver_error",
  "video_loaded",
  "video_error",
]);

interface TelemetryPayload {
  event?: string;
  sessionId?: string;
  pairingCode?: string;
  url?: string;
  details?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: TelemetryPayload = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event = String(body.event || "").slice(0, 64);
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return new Response(JSON.stringify({ error: "invalid_event" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userAgent = (req.headers.get("user-agent") || "").slice(0, 512);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from("tv_telemetry").insert({
    event,
    session_id: body.sessionId ? String(body.sessionId).slice(0, 128) : null,
    pairing_code: body.pairingCode ? String(body.pairingCode).slice(0, 16) : null,
    user_agent: userAgent,
    url: body.url ? String(body.url).slice(0, 512) : null,
    details: body.details && typeof body.details === "object" ? body.details : null,
  });

  if (error) {
    console.error("[tv-telemetry] insert failed:", error.message);
    return new Response(JSON.stringify({ error: "insert_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
