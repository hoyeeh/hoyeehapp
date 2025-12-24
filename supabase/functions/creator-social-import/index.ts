import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
}

async function fetchYouTubeChannelVideos(channelIdOrHandle: string, apiKey: string): Promise<YouTubeVideo[]> {
  // First get channel ID from handle if needed
  let channelId = channelIdOrHandle;
  
  if (channelIdOrHandle.startsWith("@") || !channelIdOrHandle.startsWith("UC")) {
    const handle = channelIdOrHandle.replace("@", "");
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`
    );
    const channelData = await channelResponse.json();
    if (channelData.items?.[0]?.id) {
      channelId = channelData.items[0].id;
    }
  }

  // Get uploads playlist
  const channelResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
  );
  const channelData = await channelResponse.json();
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    throw new Error("Could not find uploads playlist");
  }

  // Get videos from uploads playlist
  const videos: YouTubeVideo[] = [];
  let pageToken = "";

  do {
    const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const playlistResponse = await fetch(playlistUrl);
    const playlistData = await playlistResponse.json();

    if (playlistData.items) {
      const videoIds = playlistData.items.map((item: any) => item.contentDetails.videoId).join(",");
      
      // Get video details
      const videosResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${apiKey}`
      );
      const videosData = await videosResponse.json();

      for (const video of videosData.items || []) {
        videos.push({
          id: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnailUrl: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default?.url,
          duration: parseDuration(video.contentDetails.duration),
          viewCount: parseInt(video.statistics.viewCount || "0"),
          likeCount: parseInt(video.statistics.likeCount || "0"),
          publishedAt: video.snippet.publishedAt,
        });
      }
    }

    pageToken = playlistData.nextPageToken || "";
  } while (pageToken && videos.length < 100); // Limit to 100 videos

  return videos;
}

function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get creator profile
    const { data: creatorProfile } = await supabaseClient
      .from("creator_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!creatorProfile) {
      return new Response(JSON.stringify({ error: "Not a creator" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, platform, channelId, username } = await req.json();
    console.log("Social import request:", { action, platform, creatorId: creatorProfile.id });

    if (action === "connect") {
      // Save social account connection
      const { data: socialAccount, error: connectError } = await supabaseClient
        .from("creator_social_accounts")
        .upsert({
          creator_id: creatorProfile.id,
          platform,
          platform_user_id: channelId || username,
          platform_username: username || channelId,
          is_active: true,
        }, { onConflict: "creator_id,platform" })
        .select()
        .single();

      if (connectError) throw connectError;

      return new Response(
        JSON.stringify({ success: true, socialAccount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fetch-youtube") {
      if (!youtubeApiKey) {
        return new Response(JSON.stringify({ error: "YouTube API not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const videos = await fetchYouTubeChannelVideos(channelId, youtubeApiKey);
      console.log(`Fetched ${videos.length} videos from YouTube`);

      // Get or create social account
      const { data: socialAccount } = await supabaseClient
        .from("creator_social_accounts")
        .select("id")
        .eq("creator_id", creatorProfile.id)
        .eq("platform", "youtube")
        .single();

      // Import videos to creator_imported_content
      const importedContent = videos.map((video) => ({
        creator_id: creatorProfile.id,
        social_account_id: socialAccount?.id || null,
        platform: "youtube",
        platform_content_id: video.id,
        title: video.title,
        description: video.description,
        thumbnail_url: video.thumbnailUrl,
        video_url: `https://www.youtube.com/watch?v=${video.id}`,
        duration: video.duration,
        view_count: video.viewCount,
        like_count: video.likeCount,
        original_published_at: video.publishedAt,
      }));

      // Upsert to avoid duplicates
      const { error: importError } = await supabaseClient
        .from("creator_imported_content")
        .upsert(importedContent, { onConflict: "platform,platform_content_id" });

      if (importError) throw importError;

      // Update last synced
      if (socialAccount) {
        await supabaseClient
          .from("creator_social_accounts")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", socialAccount.id);
      }

      return new Response(
        JSON.stringify({ success: true, imported: videos.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list-imported") {
      const { data: imported, error: listError } = await supabaseClient
        .from("creator_imported_content")
        .select("*")
        .eq("creator_id", creatorProfile.id)
        .order("original_published_at", { ascending: false });

      if (listError) throw listError;

      return new Response(
        JSON.stringify({ success: true, content: imported }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      await supabaseClient
        .from("creator_social_accounts")
        .update({ is_active: false })
        .eq("creator_id", creatorProfile.id)
        .eq("platform", platform);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Social import error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
