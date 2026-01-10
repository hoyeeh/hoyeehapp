import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";

export interface EpisodeProgress {
  episodeId: string;
  progress: number; // in seconds
  lastWatched: string;
}

export const useEpisodeWatchProgress = (episodeIds: string[]) => {
  const { user } = useAuth();
  const { currentProfile } = useProfileContext();

  return useQuery({
    queryKey: ["episode-watch-progress", user?.id, currentProfile?.id, episodeIds],
    queryFn: async (): Promise<Record<string, EpisodeProgress>> => {
      if (!user || episodeIds.length === 0) return {};

      // Build query with profile filter
      let query = supabase
        .from("watch_history")
        .select("content_id, progress, last_watched")
        .eq("user_id", user.id)
        .in("content_id", episodeIds);
      
      // Filter by profile if one is selected
      if (currentProfile?.id) {
        query = query.eq("profile_id", currentProfile.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch episode progress:", error);
        return {};
      }

      const progressMap: Record<string, EpisodeProgress> = {};
      data?.forEach((item) => {
        progressMap[item.content_id] = {
          episodeId: item.content_id,
          progress: item.progress || 0,
          lastWatched: item.last_watched || "",
        };
      });

      return progressMap;
    },
    enabled: !!user && !!currentProfile && episodeIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
};

export const formatProgress = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const getProgressPercent = (currentProgress: number, duration: number): number => {
  if (duration === 0) return 0;
  return Math.min(100, Math.round((currentProgress / duration) * 100));
};
