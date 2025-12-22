import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface YouTubeChannel {
  id: string;
  name: string;
  channel_id: string;
  description: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  subscriber_count: string | null;
  video_count: number;
  is_active: boolean;
  display_order: number;
}

interface YouTubePlaylist {
  id: string;
  channel_id: string;
  playlist_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_count: number;
  is_active: boolean;
  display_order: number;
}

interface YouTubeVideo {
  id: string;
  playlist_id: string;
  video_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number;
  published_at: string | null;
  position: number;
}

export const useYouTubeChannels = () => {
  return useQuery({
    queryKey: ['youtube-channels-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as YouTubeChannel[];
    },
  });
};

export const useYouTubePlaylists = (channelId?: string) => {
  return useQuery({
    queryKey: ['youtube-playlists-public', channelId],
    queryFn: async () => {
      let query = supabase
        .from('youtube_playlists')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (channelId) {
        query = query.eq('channel_id', channelId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as YouTubePlaylist[];
    },
    enabled: channelId !== undefined || channelId === undefined,
  });
};

export const useYouTubeVideos = (playlistId?: string) => {
  return useQuery({
    queryKey: ['youtube-videos-public', playlistId],
    queryFn: async () => {
      if (!playlistId) return [];
      
      const { data, error } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('position');
      
      if (error) throw error;
      return data as YouTubeVideo[];
    },
    enabled: !!playlistId,
  });
};

export const useYouTubeChannelWithPlaylists = (channelId: string) => {
  return useQuery({
    queryKey: ['youtube-channel-with-playlists', channelId],
    queryFn: async () => {
      // Get channel
      const { data: channel, error: channelError } = await supabase
        .from('youtube_channels')
        .select('*')
        .eq('id', channelId)
        .eq('is_active', true)
        .single();
      
      if (channelError) throw channelError;
      
      // Get playlists
      const { data: playlists, error: playlistsError } = await supabase
        .from('youtube_playlists')
        .select('*')
        .eq('channel_id', channelId)
        .eq('is_active', true)
        .order('display_order');
      
      if (playlistsError) throw playlistsError;
      
      return {
        channel: channel as YouTubeChannel,
        playlists: playlists as YouTubePlaylist[],
      };
    },
    enabled: !!channelId,
  });
};
