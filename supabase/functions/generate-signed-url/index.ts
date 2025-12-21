import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Signing secret for URL tokens - use DO_SPACES_SECRET as the key
const SIGNING_SECRET = Deno.env.get("DO_SPACES_SECRET") || "default-secret-key";

// URL expiry time in seconds (default: 4 hours for typical viewing session)
const DEFAULT_EXPIRY_SECONDS = 4 * 60 * 60;

interface SignedUrlRequest {
  contentId: string;
  episodeId?: string;
  quality?: string;
}

interface SignedUrlResponse {
  signedUrl: string;
  expiresAt: string;
  contentTitle?: string;
}

/**
 * Convert Uint8Array to hex string
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a signed token for URL authentication using Web Crypto API
 */
async function generateSignedToken(
  userId: string,
  contentId: string,
  expiresAt: number,
  secret: string
): Promise<string> {
  const payload = `${userId}:${contentId}:${expiresAt}`;
  const encoder = new TextEncoder();
  
  // Import key for HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  // Sign the payload
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
  secret: string
): Promise<{ valid: boolean; contentId?: string; expired?: boolean }> {
  try {
    // Decode base64url
    const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'));
    const parts = decoded.split(':');
    
    if (parts.length !== 4) {
      return { valid: false };
    }
    
    const [tokenUserId, contentId, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    
    // Check if token has expired
    if (Date.now() > expiresAt) {
      return { valid: false, contentId, expired: true };
    }
    
    // Verify user matches
    if (tokenUserId !== userId) {
      return { valid: false };
    }
    
    // Verify signature using Web Crypto API
    const payload = `${tokenUserId}:${contentId}:${expiresAtStr}`;
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { contentId, episodeId, quality } = await req.json() as SignedUrlRequest;

    if (!contentId) {
      return new Response(
        JSON.stringify({ error: "Content ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating signed URL for user ${user.id}, content ${contentId}`);

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
      
      // Check if episode is premium
      if (episode.is_premium) {
        const isSubscribed = profile?.is_subscribed && 
          (!profile.subscription_expiry || new Date(profile.subscription_expiry) > new Date());
        
        if (!isSubscribed) {
          return new Response(
            JSON.stringify({ error: "Premium subscription required for this episode" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Check if content is premium and user has valid subscription
    if (content.is_premium) {
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

    // Generate signed URL
    const expiresAt = Date.now() + (DEFAULT_EXPIRY_SECONDS * 1000);
    const signedToken = await generateSignedToken(user.id, contentId, expiresAt, SIGNING_SECRET);
    
    // Append signed token as query parameter to the video URL
    const signedUrl = new URL(videoUrl);
    signedUrl.searchParams.set("token", signedToken);
    signedUrl.searchParams.set("uid", user.id);
    signedUrl.searchParams.set("exp", expiresAt.toString());
    
    if (quality) {
      signedUrl.searchParams.set("quality", quality);
    }

    console.log(`Generated signed URL for content ${contentId}, expires at ${new Date(expiresAt).toISOString()}`);

    const response: SignedUrlResponse = {
      signedUrl: signedUrl.toString(),
      expiresAt: new Date(expiresAt).toISOString(),
      contentTitle,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-signed-url:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
