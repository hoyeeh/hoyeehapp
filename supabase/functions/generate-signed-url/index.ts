import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Signing secret for URL tokens
const SIGNING_SECRET = Deno.env.get("DO_SPACES_SECRET") || "default-secret-key";

// CDN endpoint for DigitalOcean Spaces
const CDN_ENDPOINT = Deno.env.get("DO_SPACES_CDN_ENDPOINT") || "";

// URL expiry time in seconds (default: 4 hours for typical viewing session)
const DEFAULT_EXPIRY_SECONDS = 4 * 60 * 60;

// Allowed referrers for hotlink protection
const ALLOWED_REFERRERS = [
  "hoyeeh.com",
  "www.hoyeeh.com",
  "localhost",
  "127.0.0.1",
  "lovable.app",
  "lovableproject.com",
];

interface SignedUrlRequest {
  contentId: string;
  episodeId?: string;
  quality?: string;
  forDownload?: boolean;
}

interface SignedUrlResponse {
  signedUrl: string;
  expiresAt: string;
  contentTitle?: string;
  cdnUrl?: string;
}

/**
 * Convert Uint8Array to hex string
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert origin URL to CDN URL
 */
function toCdnUrl(originUrl: string): string {
  if (!originUrl) return originUrl;
  if (originUrl.includes('.cdn.digitaloceanspaces.com')) return originUrl;
  return originUrl.replace('.digitaloceanspaces.com', '.cdn.digitaloceanspaces.com');
}

/**
 * Generate a signed token for URL authentication using Web Crypto API
 */
async function generateSignedToken(
  userId: string,
  contentId: string,
  expiresAt: number,
  clientIp: string,
  secret: string
): Promise<string> {
  // Include IP in payload for additional security
  const payload = `${userId}:${contentId}:${expiresAt}:${clientIp}`;
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
  
  // Return base64url encoded token
  const token = btoa(`${payload}:${signatureHex}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return token;
}

/**
 * Verify a signed token using Web Crypto API
 */
async function verifySignedToken(
  token: string,
  userId: string,
  clientIp: string,
  secret: string
): Promise<{ valid: boolean; contentId?: string; expired?: boolean }> {
  try {
    const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const parts = decoded.split(':');
    
    if (parts.length !== 5) {
      return { valid: false };
    }
    
    const [tokenUserId, contentId, expiresAtStr, tokenIp, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    
    // Check if token has expired
    if (Date.now() > expiresAt) {
      return { valid: false, contentId, expired: true };
    }
    
    // Verify user matches
    if (tokenUserId !== userId) {
      return { valid: false };
    }
    
    // Verify IP matches (optional - can be disabled for mobile users)
    // if (tokenIp !== clientIp) {
    //   return { valid: false };
    // }
    
    // Verify signature
    const payload = `${tokenUserId}:${contentId}:${expiresAtStr}:${tokenIp}`;
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

/**
 * Check if referrer is allowed (hotlink protection)
 */
function isReferrerAllowed(referrer: string | null): boolean {
  if (!referrer) return true; // Allow direct requests
  
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check referrer for hotlink protection
    const referrer = req.headers.get("referer");
    if (!isReferrerAllowed(referrer)) {
      console.warn(`Blocked request from unauthorized referrer: ${referrer}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized referrer" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP for token binding
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { contentId, episodeId, quality, forDownload } = await req.json() as SignedUrlRequest;

    if (!contentId) {
      return new Response(
        JSON.stringify({ error: "Content ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating signed URL for user ${user.id}, content ${contentId}, IP: ${clientIp}`);

    // Check user subscription status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_subscribed, subscription_expiry")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      return new Response(
        JSON.stringify({ error: "Could not verify subscription status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch content details
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("id, title, video_url, is_premium")
      .eq("id", contentId)
      .single();

    if (contentError || !content) {
      console.error("Content fetch error:", contentError);
      return new Response(
        JSON.stringify({ error: "Content not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let videoUrl = content.video_url;
    let contentTitle = content.title;
    let isPremium = content.is_premium;

    // If episode ID provided, fetch episode video URL
    if (episodeId) {
      const { data: episode, error: episodeError } = await supabase
        .from("episodes")
        .select("id, title, video_url, is_premium")
        .eq("id", episodeId)
        .single();

      if (episodeError || !episode) {
        console.error("Episode fetch error:", episodeError);
        return new Response(
          JSON.stringify({ error: "Episode not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      videoUrl = episode.video_url;
      contentTitle = `${content.title} - ${episode.title}`;
      isPremium = episode.is_premium || content.is_premium;
    }

    // Check if content is premium and user has valid subscription
    if (isPremium) {
      const isSubscribed = profile?.is_subscribed && 
        (!profile.subscription_expiry || new Date(profile.subscription_expiry) > new Date());
      
      if (!isSubscribed) {
        // Check for admin role
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        
        const isAdmin = roles?.some(r => r.role === "admin" || r.role === "super_admin");
        
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: "Premium subscription required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "Video URL not available" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For downloads, use longer expiry (7 days)
    const expirySeconds = forDownload ? 7 * 24 * 60 * 60 : DEFAULT_EXPIRY_SECONDS;
    const expiresAt = Date.now() + (expirySeconds * 1000);
    
    // Generate signed token with IP binding
    const signedToken = await generateSignedToken(
      user.id, 
      episodeId || contentId, 
      expiresAt, 
      clientIp,
      SIGNING_SECRET
    );
    
    // Convert to CDN URL for better performance
    const cdnVideoUrl = toCdnUrl(videoUrl);
    
    // Append signed token as query parameter to the video URL
    const signedUrl = new URL(cdnVideoUrl);
    signedUrl.searchParams.set("token", signedToken);
    signedUrl.searchParams.set("uid", user.id);
    signedUrl.searchParams.set("exp", expiresAt.toString());
    
    if (quality) {
      signedUrl.searchParams.set("quality", quality);
    }

    // Log for analytics
    console.log(`Generated signed URL for content ${contentId}, expires at ${new Date(expiresAt).toISOString()}, forDownload: ${forDownload}`);

    // Record download license if this is for download
    if (forDownload) {
      await supabase.from("download_licenses").upsert({
        user_id: user.id,
        content_id: contentId,
        episode_id: episodeId || null,
        device_id: clientIp, // Using IP as device identifier for now
        encrypted_key: signedToken,
        expires_at: new Date(expiresAt).toISOString(),
        status: 'active',
        quality: quality || 'auto',
      }, {
        onConflict: 'user_id,content_id,episode_id,device_id',
      });
    }

    const response: SignedUrlResponse = {
      signedUrl: signedUrl.toString(),
      expiresAt: new Date(expiresAt).toISOString(),
      contentTitle,
      cdnUrl: cdnVideoUrl,
    };

    return new Response(JSON.stringify(response), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        // Add cache headers for CDN
        "Cache-Control": "private, max-age=0",
      },
    });

  } catch (error) {
    console.error("Error in generate-signed-url:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
