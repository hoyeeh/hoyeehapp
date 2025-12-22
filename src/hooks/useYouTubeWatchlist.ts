import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface YouTubeWatchlistItem {
  id: string;
  user_id: string;
  video_id: string;
  video_title: string;
  thumbnail_url: string | null;
  duration: number | null;
  channel_name: string | null;
  added_at: string;
}

export function useYouTubeWatchlist() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['youtube-watchlist', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('youtube_watchlist')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });
      
      if (error) throw error;
      return data as YouTubeWatchlistItem[];
    },
    enabled: !!user?.id,
  });
}

export function useIsInWatchlist(videoId: string) {
  const { data: watchlist } = useYouTubeWatchlist();
  return watchlist?.some(item => item.video_id === videoId) ?? false;
}

export function useToggleWatchlist() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      videoId, 
      videoTitle, 
      thumbnailUrl, 
      duration, 
      channelName,
      isInWatchlist 
    }: { 
      videoId: string; 
      videoTitle: string; 
      thumbnailUrl?: string | null;
      duration?: number | null;
      channelName?: string | null;
      isInWatchlist: boolean;
    }) => {
      if (!user?.id) throw new Error("Must be logged in");
      
      if (isInWatchlist) {
        // Remove from watchlist
        const { error } = await supabase
          .from('youtube_watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);
        
        if (error) throw error;
        return { action: 'removed' };
      } else {
        // Add to watchlist
        const { error } = await supabase
          .from('youtube_watchlist')
          .insert({
            user_id: user.id,
            video_id: videoId,
            video_title: videoTitle,
            thumbnail_url: thumbnailUrl,
            duration: duration,
            channel_name: channelName,
          });
        
        if (error) throw error;
        return { action: 'added' };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['youtube-watchlist'] });
      toast.success(result.action === 'added' ? "Added to Watch Later" : "Removed from Watch Later");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update watchlist");
    },
  });
}
