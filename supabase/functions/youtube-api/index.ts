import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface YouTubeChannelInfo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: string;
  videoCount: number;
}

interface YouTubePlaylistInfo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  itemCount: number;
}

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

// Extract channel ID from various URL formats
function extractChannelId(input: string): string {
  // Already a channel ID (24 chars starting with UC)
  if (input.startsWith('UC') && input.length === 24) {
    return input;
  }
  
  // URL formats - UC followed by exactly 22 more characters = 24 total
  const patterns = [
    /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/,
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  
  return input;
}

// Fetch channel info from YouTube API
async function getChannelInfo(channelIdOrHandle: string): Promise<YouTubeChannelInfo | null> {
  const identifier = extractChannelId(channelIdOrHandle);
  
  // Try by channel ID first
  let url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${identifier}&key=${YOUTUBE_API_KEY}`;
  
  let response = await fetch(url);
  let data = await response.json();
  
  // If no results, try by handle/username
  if (!data.items || data.items.length === 0) {
    // Try forHandle parameter
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${identifier}&key=${YOUTUBE_API_KEY}`;
    response = await fetch(url);
    data = await response.json();
  }
  
  // Still no results, try forUsername
  if (!data.items || data.items.length === 0) {
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forUsername=${identifier}&key=${YOUTUBE_API_KEY}`;
    response = await fetch(url);
    data = await response.json();
  }
  
  if (!data.items || data.items.length === 0) {
    console.log('No channel found for:', identifier);
    return null;
  }
  
  const channel = data.items[0];
  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    thumbnailUrl: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
    subscriberCount: channel.statistics.subscriberCount,
    videoCount: parseInt(channel.statistics.videoCount) || 0,
  };
}

// Get all playlists from a channel
async function getChannelPlaylists(channelId: string): Promise<YouTubePlaylistInfo[]> {
  const playlists: YouTubePlaylistInfo[] = [];
  let nextPageToken = '';
  
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=50&pageToken=${nextPageToken}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.items) {
      for (const item of data.items) {
        playlists.push({
          id: item.id,
          title: item.snippet.title,
          description: item.snippet.description || '',
          thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '',
          itemCount: item.contentDetails.itemCount || 0,
        });
      }
    }
    
    nextPageToken = data.nextPageToken || '';
  } while (nextPageToken);
  
  return playlists;
}

// Get videos from a playlist
async function getPlaylistVideos(playlistId: string): Promise<YouTubeVideoInfo[]> {
  const videos: YouTubeVideoInfo[] = [];
  let nextPageToken = '';
  
  do {
    // First get playlist items
    const listUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${YOUTUBE_API_KEY}`;
    const listResponse = await fetch(listUrl);
    const listData = await listResponse.json();
    
    if (!listData.items || listData.items.length === 0) break;
    
    // Get video IDs for duration and view count
    const videoIds = listData.items.map((item: any) => item.contentDetails.videoId).join(',');
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    const videosResponse = await fetch(videosUrl);
    const videosData = await videosResponse.json();
    
    // Create a map of video details
    const videoDetails: Record<string, { duration: number; viewCount: number }> = {};
    if (videosData.items) {
      for (const video of videosData.items) {
        videoDetails[video.id] = {
          duration: parseDuration(video.contentDetails.duration),
          viewCount: parseInt(video.statistics?.viewCount || '0'),
        };
      }
    }
    
    // Combine data
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

serve(async (req) => {
  // Handle CORS preflight
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
    const { action, channelId, playlistId, dbChannelId, dbPlaylistId } = await req.json();
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    switch (action) {
      case 'validate-channel': {
        // Validate and get channel info
        const channelInfo = await getChannelInfo(channelId);
        if (!channelInfo) {
          return new Response(
            JSON.stringify({ error: 'Channel not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify(channelInfo),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'sync-playlists': {
        // Sync playlists for a channel
        console.log('Syncing playlists for channel:', channelId);
        const playlists = await getChannelPlaylists(channelId);
        
        // Upsert playlists to database
        for (const playlist of playlists) {
          await supabase.from('youtube_playlists').upsert({
            channel_id: dbChannelId,
            playlist_id: playlist.id,
            title: playlist.title,
            description: playlist.description,
            thumbnail_url: playlist.thumbnailUrl,
            video_count: playlist.itemCount,
          }, {
            onConflict: 'channel_id,playlist_id',
          });
        }
        
        console.log(`Synced ${playlists.length} playlists`);
        return new Response(
          JSON.stringify({ success: true, count: playlists.length, playlists }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'sync-videos': {
        // Sync videos for a playlist
        console.log('Syncing videos for playlist:', playlistId);
        const videos = await getPlaylistVideos(playlistId);
        
        // Upsert videos to database
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
        
        // Update playlist video count
        await supabase.from('youtube_playlists')
          .update({ video_count: videos.length })
          .eq('id', dbPlaylistId);
        
        console.log(`Synced ${videos.length} videos`);
        return new Response(
          JSON.stringify({ success: true, count: videos.length }),
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
    console.error('YouTube API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
