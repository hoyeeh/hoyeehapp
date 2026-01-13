import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-range, accept-ranges, content-length",
};

// Signing secret for token verification
const SIGNING_SECRET = Deno.env.get("DO_SPACES_SECRET") || "default-secret-key";

// Token expiry: 30 minutes for streaming
const STREAM_TOKEN_EXPIRY_SECONDS = 30 * 60;

// Allowed referrers
const ALLOWED_REFERRERS = [
  "hoyeeh.com",
  "www.hoyeeh.com",
  "localhost",
  "127.0.0.1",
  "lovable.app",
  "lovableproject.com",
];

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a short-lived stream token
 */
async function generateStreamToken(
  userId: string,
  contentId: string,
  secret: string
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + (STREAM_TOKEN_EXPIRY_SECONDS * 1000);
  const payload = `stream:${userId}:${contentId}:${expiresAt}`;
  const encoder = new TextEncoder();
  
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  
  const signatureHex = toHex(new Uint8Array(signature));
  const token = btoa(`${payload}:${signatureHex}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return { token, expiresAt };
}

/**
 * Verify a stream token
 */
async function verifyStreamToken(
  token: string,
  userId: string,
  secret: string
): Promise<{ valid: boolean; contentId?: string; expired?: boolean }> {
  try {
    const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const parts = decoded.split(':');
    
    if (parts.length !== 5 || parts[0] !== 'stream') {
      return { valid: false };
    }
    
    const [, tokenUserId, contentId, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    
    if (Date.now() > expiresAt) {
      return { valid: false, contentId, expired: true };
    }
    
    if (tokenUserId !== userId) {
      return { valid: false };
    }
    
    // Verify signature
    const payload = `stream:${tokenUserId}:${contentId}:${expiresAtStr}`;
    const encoder = new TextEncoder();
    
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const expectedSignature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );
    
    const expectedSignatureHex = toHex(new Uint8Array(expectedSignature));
    
    if (signature !== expectedSignatureHex) {
      return { valid: false };
    }
    
    return { valid: true, contentId };
  } catch {
    return { valid: false };
  }
}

function isReferrerAllowed(referrer: string | null): boolean {
  if (!referrer) return true;
  
  try {
    const url = new URL(referrer);
    const hostname = url.hostname.toLowerCase();
    return ALLOWED_REFERRERS.some(allowed => 
      hostname === allowed || hostname.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const referrer = req.headers.get("referer");
    if (!isReferrerAllowed(referrer)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jwtToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Generate stream token
    if (action === "token") {
      const { contentId, episodeId } = await req.json();
      
      if (!contentId) {
        return new Response(
          JSON.stringify({ error: "Content ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const effectiveContentId = episodeId || contentId;
      const { token, expiresAt } = await generateStreamToken(user.id, effectiveContentId, SIGNING_SECRET);

      console.log(`[stream-video] Generated token for user ${user.id}, content ${effectiveContentId}`);

      return new Response(
        JSON.stringify({ 
          streamToken: token, 
          expiresAt: new Date(expiresAt).toISOString(),
          streamUrl: `${url.origin}/stream-video?stream=${token}&uid=${user.id}`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Stream video (proxy)
    const streamToken = url.searchParams.get("stream");
    const uid = url.searchParams.get("uid");
    const contentId = url.searchParams.get("cid");

    if (!streamToken || !uid) {
      return new Response(
        JSON.stringify({ error: "Stream token and user ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify stream token
    const verification = await verifyStreamToken(streamToken, uid, SIGNING_SECRET);
    
    if (!verification.valid) {
      if (verification.expired) {
        return new Response(
          JSON.stringify({ error: "Stream token expired" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Invalid stream token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch video URL from database
    let videoUrl: string | null = null;
    
    if (contentId) {
      // Check if it's an episode ID
      const { data: episode } = await supabase
        .from("episodes")
        .select("video_url")
        .eq("id", contentId)
        .single();
      
      if (episode?.video_url) {
        videoUrl = episode.video_url;
      } else {
        // Try as content ID
        const { data: content } = await supabase
          .from("content")
          .select("video_url")
          .eq("id", contentId)
          .single();
        
        videoUrl = content?.video_url || null;
      }
    }

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "Video not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Proxy the video request
    const rangeHeader = req.headers.get("range");
    const fetchHeaders: HeadersInit = {};
    
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    console.log(`[stream-video] Proxying video for user ${uid}, content ${contentId}`);

    const videoResponse = await fetch(videoUrl, {
      headers: fetchHeaders,
    });

    if (!videoResponse.ok && videoResponse.status !== 206) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch video" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Forward response with security headers
    const responseHeaders: HeadersInit = {
      ...corsHeaders,
      "Content-Type": videoResponse.headers.get("content-type") || "video/mp4",
      "Accept-Ranges": "bytes",
      // Security headers to prevent caching of video
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    };

    if (videoResponse.headers.get("content-length")) {
      responseHeaders["Content-Length"] = videoResponse.headers.get("content-length")!;
    }
    
    if (videoResponse.headers.get("content-range")) {
      responseHeaders["Content-Range"] = videoResponse.headers.get("content-range")!;
    }

    return new Response(videoResponse.body, {
      status: videoResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error("[stream-video] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
