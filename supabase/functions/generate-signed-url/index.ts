import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
 * Extract storage path from full URL or storage path
 * Handles both Supabase storage URLs and external CDN URLs
 */
function extractStoragePath(videoUrl: string): { isSupabaseStorage: boolean; path?: string; originalUrl?: string } {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    
    // Check if it's a Supabase storage URL
    if (videoUrl.includes(supabaseUrl) && videoUrl.includes("/storage/v1/object/public/videos/")) {
      const path = videoUrl.split("/storage/v1/object/public/videos/")[1];
      return { isSupabaseStorage: true, path };
    }
    
    // Check for authenticated storage URL format
    if (videoUrl.includes(supabaseUrl) && videoUrl.includes("/storage/v1/object/videos/")) {
      const path = videoUrl.split("/storage/v1/object/videos/")[1];
      return { isSupabaseStorage: true, path };
    }
    
    // It's an external URL (DigitalOcean Spaces, CDN, etc.)
    return { isSupabaseStorage: false, originalUrl: videoUrl };
  } catch {
    return { isSupabaseStorage: false, originalUrl: videoUrl };
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

    // Initialize Supabase client with service role for storage operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user with their token
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

    const expiresAt = Date.now() + (DEFAULT_EXPIRY_SECONDS * 1000);
    let signedUrl: string;

    // Check if video is in Supabase storage or external
    const storageInfo = extractStoragePath(videoUrl);

    if (storageInfo.isSupabaseStorage && storageInfo.path) {
      // Generate Supabase Storage signed URL (cryptographically secure)
      console.log(`Generating Supabase signed URL for path: ${storageInfo.path}`);
      
      const { data: signedUrlData, error: signedUrlError } = await supabase
        .storage
        .from("videos")
        .createSignedUrl(storageInfo.path, DEFAULT_EXPIRY_SECONDS);

      if (signedUrlError || !signedUrlData) {
        console.error("Signed URL generation error:", signedUrlError);
        return new Response(
          JSON.stringify({ error: "Failed to generate signed URL" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      signedUrl = signedUrlData.signedUrl;
      console.log(`Generated Supabase signed URL for content ${contentId}, expires in ${DEFAULT_EXPIRY_SECONDS}s`);
    } else {
      // External URL (DigitalOcean Spaces, CDN, etc.)
      // Add tracking parameters but URL itself is not cryptographically protected
      console.log(`Using external URL with tracking parameters for content ${contentId}`);
      
      const url = new URL(storageInfo.originalUrl!);
      url.searchParams.set("uid", user.id);
      url.searchParams.set("exp", expiresAt.toString());
      url.searchParams.set("cid", contentId);
      
      if (quality) {
        url.searchParams.set("quality", quality);
      }
      
      signedUrl = url.toString();
    }

    const response: SignedUrlResponse = {
      signedUrl,
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
