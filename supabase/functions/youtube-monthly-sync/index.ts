const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface YouTubePlaylistItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
  contentDetails: {
    itemCount: number;
  };
}

interface YouTubeVideoItem {
  snippet: {
    resourceId: { videoId: string };
    title: string;
    description: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
    publishedAt: string;
    position: number;
  };
  contentDetails?: {
    videoId: string;
  };
}

interface SyncResult {
  channelsSynced: number;
  playlistsSynced: number;
  playlistsSkipped: number;
  videosAdded: number;
  errors: string[];
}

interface DbPlaylist {
  id: string;
  playlist_id: string;
  video_count: number;
}

interface DbChannel {
  id: string;
  channel_id: string;
  name: string;
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChannelPlaylists(
  channelId: string,
  apiKey: string
): Promise<YouTubePlaylistItem[]> {
  const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=50&key=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch playlists for channel ${channelId}: ${errorText}`);
  }
  
  const data = await response.json();
  return data.items || [];
}

async function fetchPlaylistVideos(
  playlistId: string,
  apiKey: string
): Promise<YouTubeVideoItem[]> {
  const allVideos: YouTubeVideoItem[] = [];
  let pageToken = "";
  
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch videos for playlist ${playlistId}: ${errorText}`);
    }
    
    const data = await response.json();
    allVideos.push(...(data.items || []));
    pageToken = data.nextPageToken || "";
    
    // Rate limiting between pages
    if (pageToken) {
      await delay(200);
    }
  } while (pageToken);
  
  return allVideos;
}

async function syncChannel(
  supabaseUrl: string,
  supabaseServiceKey: string,
  channel: DbChannel,
  apiKey: string,
  result: SyncResult
) {
  console.log(`[youtube-monthly-sync] Syncing channel: ${channel.name}`);
  
  try {
    // Fetch all playlists from YouTube
    const youtubePlaylists = await fetchChannelPlaylists(channel.channel_id, apiKey);
    console.log(`[youtube-monthly-sync] Found ${youtubePlaylists.length} playlists for channel ${channel.name}`);
    
    // Get existing playlists from database using REST API
    const playlistsResponse = await fetch(
      `${supabaseUrl}/rest/v1/youtube_playlists?channel_id=eq.${channel.id}&select=id,playlist_id,video_count`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!playlistsResponse.ok) {
      throw new Error(`Failed to fetch DB playlists: ${await playlistsResponse.text()}`);
    }
    
    const dbPlaylists: DbPlaylist[] = await playlistsResponse.json();
    const dbPlaylistMap = new Map(dbPlaylists.map((p) => [p.playlist_id, p]));
    
    for (const ytPlaylist of youtubePlaylists) {
      const thumbnail =
        ytPlaylist.snippet.thumbnails?.high?.url ||
        ytPlaylist.snippet.thumbnails?.medium?.url ||
        ytPlaylist.snippet.thumbnails?.default?.url ||
        null;
      
      const existingPlaylist = dbPlaylistMap.get(ytPlaylist.id);
      const youtubeVideoCount = ytPlaylist.contentDetails.itemCount;
      
      // Upsert the playlist
      const upsertPlaylistResponse = await fetch(
        `${supabaseUrl}/rest/v1/youtube_playlists?on_conflict=playlist_id`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify({
            channel_id: channel.id,
            playlist_id: ytPlaylist.id,
            title: ytPlaylist.snippet.title,
            description: ytPlaylist.snippet.description || null,
            thumbnail_url: thumbnail,
            video_count: youtubeVideoCount,
            updated_at: new Date().toISOString(),
          }),
        }
      );
      
      if (!upsertPlaylistResponse.ok) {
        const errorText = await upsertPlaylistResponse.text();
        console.error(`[youtube-monthly-sync] Failed to upsert playlist ${ytPlaylist.id}: ${errorText}`);
        result.errors.push(`Playlist upsert error: ${errorText}`);
        continue;
      }
      
      const upsertedPlaylists = await upsertPlaylistResponse.json();
      const playlistDbId = upsertedPlaylists?.[0]?.id || existingPlaylist?.id;
      
      // Check if video count changed - only sync videos if it did
      const dbVideoCount = existingPlaylist?.video_count || 0;
      
      if (youtubeVideoCount !== dbVideoCount) {
        console.log(`[youtube-monthly-sync] Playlist "${ytPlaylist.snippet.title}" changed (${dbVideoCount} -> ${youtubeVideoCount}), syncing videos...`);
        
        // Fetch and sync videos for this playlist
        const videos = await fetchPlaylistVideos(ytPlaylist.id, apiKey);
        
        for (const video of videos) {
          const videoThumbnail =
            video.snippet.thumbnails?.high?.url ||
            video.snippet.thumbnails?.medium?.url ||
            video.snippet.thumbnails?.default?.url ||
            null;
          
          const videoId = video.snippet.resourceId?.videoId || video.contentDetails?.videoId;
          
          if (!videoId) continue;
          
          const upsertVideoResponse = await fetch(
            `${supabaseUrl}/rest/v1/youtube_videos?on_conflict=video_id`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates',
              },
              body: JSON.stringify({
                playlist_id: playlistDbId,
                video_id: videoId,
                title: video.snippet.title,
                description: video.snippet.description || null,
                thumbnail_url: videoThumbnail,
                published_at: video.snippet.publishedAt,
                position: video.snippet.position,
                updated_at: new Date().toISOString(),
              }),
            }
          );
          
          if (!upsertVideoResponse.ok) {
            const errorText = await upsertVideoResponse.text();
            console.error(`[youtube-monthly-sync] Failed to upsert video ${videoId}: ${errorText}`);
          } else {
            result.videosAdded++;
          }
        }
        
        // Update playlist last_synced_at
        await fetch(
          `${supabaseUrl}/rest/v1/youtube_playlists?id=eq.${playlistDbId}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ last_synced_at: new Date().toISOString() }),
          }
        );
        
        result.playlistsSynced++;
        
        // Rate limiting between playlist syncs
        await delay(500);
      } else {
        console.log(`[youtube-monthly-sync] Playlist "${ytPlaylist.snippet.title}" unchanged (${dbVideoCount} videos), skipping`);
        result.playlistsSkipped++;
      }
    }
    
    // Update channel last_synced_at
    await fetch(
      `${supabaseUrl}/rest/v1/youtube_channels?id=eq.${channel.id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }),
      }
    );
    
    result.channelsSynced++;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[youtube-monthly-sync] Error syncing channel ${channel.name}: ${errorMessage}`);
    result.errors.push(`Channel ${channel.name}: ${errorMessage}`);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  console.log("[youtube-monthly-sync] Starting monthly sync...");
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[youtube-monthly-sync] Missing Supabase credentials");
    return new Response(
      JSON.stringify({ error: "Missing Supabase credentials" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  if (!youtubeApiKey) {
    console.error("[youtube-monthly-sync] Missing YouTube API key");
    return new Response(
      JSON.stringify({ error: "Missing YouTube API key" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  const result: SyncResult = {
    channelsSynced: 0,
    playlistsSynced: 0,
    playlistsSkipped: 0,
    videosAdded: 0,
    errors: [],
  };
  
  try {
    // Fetch all active channels using REST API
    const channelsResponse = await fetch(
      `${supabaseUrl}/rest/v1/youtube_channels?is_active=eq.true&select=id,channel_id,name`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!channelsResponse.ok) {
      throw new Error(`Failed to fetch channels: ${await channelsResponse.text()}`);
    }
    
    const channels: DbChannel[] = await channelsResponse.json();
    
    console.log(`[youtube-monthly-sync] Found ${channels?.length || 0} active channels to sync`);
    
    if (!channels || channels.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No active channels to sync",
          result 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Sync each channel
    for (const channel of channels) {
      await syncChannel(supabaseUrl, supabaseServiceKey, channel, youtubeApiKey, result);
      
      // Rate limiting between channels
      await delay(1000);
    }
    
    console.log("[youtube-monthly-sync] Sync completed:", result);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Monthly sync completed",
        result 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[youtube-monthly-sync] Fatal error:", errorMessage);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        result 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});