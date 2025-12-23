import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: string;
  viewCount: number;
  position: number;
}

// Parse ISO 8601 duration to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
}

// Get videos from a playlist
async function getPlaylistVideos(playlistId: string): Promise<YouTubeVideoInfo[]> {
  const videos: YouTubeVideoInfo[] = [];
  let nextPageToken = '';
  
  do {
    const listUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${YOUTUBE_API_KEY}`;
    const listResponse = await fetch(listUrl);
    const listData = await listResponse.json();
    
    if (!listData.items || listData.items.length === 0) break;
    
    const videoIds = listData.items.map((item: any) => item.contentDetails.videoId).join(',');
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    const videosResponse = await fetch(videosUrl);
    const videosData = await videosResponse.json();
    
    const videoDetails: Record<string, { duration: number; viewCount: number }> = {};
    if (videosData.items) {
      for (const video of videosData.items) {
        videoDetails[video.id] = {
          duration: parseDuration(video.contentDetails.duration),
          viewCount: parseInt(video.statistics?.viewCount || '0'),
        };
      }
    }
    
    for (const item of listData.items) {
      const videoId = item.contentDetails.videoId;
      const details = videoDetails[videoId] || { duration: 0, viewCount: 0 };
      
      videos.push({
        id: videoId,
        title: item.snippet.title,
        description: item.snippet.description || '',
        thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
        duration: details.duration,
        publishedAt: item.contentDetails.videoPublishedAt || item.snippet.publishedAt,
        viewCount: details.viewCount,
        position: item.snippet.position || 0,
      });
    }
    
    nextPageToken = listData.nextPageToken || '';
  } while (nextPageToken);
  
  return videos;
}

// Sync videos for a single playlist
async function syncPlaylistVideos(
  supabase: any,
  playlistId: string,
  dbPlaylistId: string
): Promise<number> {
  console.log(`Syncing videos for playlist: ${playlistId}`);
  const videos = await getPlaylistVideos(playlistId);
  
  for (const video of videos) {
    await supabase.from('youtube_videos').upsert({
      playlist_id: dbPlaylistId,
      video_id: video.id,
      title: video.title,
      description: video.description,
      thumbnail_url: video.thumbnailUrl,
      duration: video.duration,
      published_at: video.publishedAt,
      view_count: video.viewCount,
      position: video.position,
    }, {
      onConflict: 'playlist_id,video_id',
    });
  }
  
  await supabase.from('youtube_playlists')
    .update({ video_count: videos.length, last_synced_at: new Date().toISOString() })
    .eq('id', dbPlaylistId);
  
  return videos.length;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (!YOUTUBE_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'YouTube API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const { action, playlistIds, limit } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    switch (action) {
      case 'auto-sync-unsynced': {
        // Find playlists that have never been synced (video_count is 0 or null)
        // or haven't been synced in a while
        console.log('Finding unsynced playlists...');
        
        const { data: unsyncedPlaylists, error: fetchError } = await supabase
          .from('youtube_playlists')
          .select(`
            id,
            playlist_id,
            title,
            channel_id,
            youtube_channels!inner(is_active, is_kids_friendly)
          `)
          .eq('is_active', true)
          .or('video_count.is.null,video_count.eq.0')
          .limit(limit || 10);
        
        if (fetchError) {
          console.error('Error fetching playlists:', fetchError);
          throw fetchError;
        }
        
        console.log(`Found ${unsyncedPlaylists?.length || 0} unsynced playlists`);
        
        const results: { playlistId: string; title: string; videoCount: number; error?: string }[] = [];
        
        for (const playlist of unsyncedPlaylists || []) {
          try {
            const videoCount = await syncPlaylistVideos(
              supabase,
              playlist.playlist_id,
              playlist.id
            );
            results.push({
              playlistId: playlist.id,
              title: playlist.title,
              videoCount,
            });
            console.log(`Synced ${videoCount} videos for "${playlist.title}"`);
          } catch (error: any) {
            console.error(`Error syncing playlist ${playlist.title}:`, error);
            results.push({
              playlistId: playlist.id,
              title: playlist.title,
              videoCount: 0,
              error: error.message,
            });
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const totalVideos = results.reduce((sum, r) => sum + r.videoCount, 0);
        console.log(`Auto-sync complete: ${results.length} playlists, ${totalVideos} videos`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            playlistsSynced: results.length,
            totalVideos,
            results 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'bulk-sync': {
        // Sync specific playlists by their IDs
        if (!playlistIds || !Array.isArray(playlistIds) || playlistIds.length === 0) {
          return new Response(
            JSON.stringify({ error: 'playlistIds array is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`Bulk syncing ${playlistIds.length} playlists...`);
        
        // Fetch playlist details
        const { data: playlists, error: fetchError } = await supabase
          .from('youtube_playlists')
          .select('id, playlist_id, title')
          .in('id', playlistIds);
        
        if (fetchError) throw fetchError;
        
        const results: { playlistId: string; title: string; videoCount: number; error?: string }[] = [];
        
        for (const playlist of playlists || []) {
          try {
            const videoCount = await syncPlaylistVideos(
              supabase,
              playlist.playlist_id,
              playlist.id
            );
            results.push({
              playlistId: playlist.id,
              title: playlist.title,
              videoCount,
            });
            console.log(`Synced ${videoCount} videos for "${playlist.title}"`);
          } catch (error: any) {
            console.error(`Error syncing playlist ${playlist.title}:`, error);
            results.push({
              playlistId: playlist.id,
              title: playlist.title,
              videoCount: 0,
              error: error.message,
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const totalVideos = results.reduce((sum, r) => sum + r.videoCount, 0);
        console.log(`Bulk sync complete: ${results.length} playlists, ${totalVideos} videos`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            playlistsSynced: results.length,
            totalVideos,
            results 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'get-unsynced-count': {
        // Get count of unsynced playlists
        const { count, error } = await supabase
          .from('youtube_playlists')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .or('video_count.is.null,video_count.eq.0');
        
        if (error) throw error;
        
        return new Response(
          JSON.stringify({ unsyncedCount: count || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('YouTube Auto-Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
