import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TVShowUpdateInfo {
  hasNewEpisode: boolean;
  hasNewSeason: boolean;
}

export type TVShowUpdatesMap = Record<string, TVShowUpdateInfo>;

const NEW_CONTENT_DAYS = 7;

export const useLatestTVShowUpdates = (contentIds: string[]) => {
  return useQuery({
    queryKey: ['tv-show-updates', contentIds.sort().join(',')],
    queryFn: async (): Promise<TVShowUpdatesMap> => {
      if (!contentIds.length) return {};

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - NEW_CONTENT_DAYS);
      const cutoffISO = cutoffDate.toISOString();

      // Get all seasons for these content IDs
      const { data: seasons, error: seasonsError } = await supabase
        .from('seasons')
        .select('id, content_id, created_at')
        .in('content_id', contentIds);

      if (seasonsError) {
        console.error('Error fetching seasons:', seasonsError);
        return {};
      }

      if (!seasons || seasons.length === 0) return {};

      const seasonIds = seasons.map(s => s.id);

      // Get all episodes for these seasons
      const { data: episodes, error: episodesError } = await supabase
        .from('episodes')
        .select('id, season_id, created_at')
        .in('season_id', seasonIds);

      if (episodesError) {
        console.error('Error fetching episodes:', episodesError);
        return {};
      }

      // Build a map of season_id -> content_id
      const seasonToContent: Record<string, string> = {};
      seasons.forEach(s => {
        seasonToContent[s.id] = s.content_id;
      });

      // Build the updates map
      const updatesMap: TVShowUpdatesMap = {};

      // Check for new seasons
      seasons.forEach(season => {
        if (new Date(season.created_at) > cutoffDate) {
          if (!updatesMap[season.content_id]) {
            updatesMap[season.content_id] = { hasNewEpisode: false, hasNewSeason: false };
          }
          updatesMap[season.content_id].hasNewSeason = true;
        }
      });

      // Check for new episodes
      episodes?.forEach(episode => {
        const contentId = seasonToContent[episode.season_id];
        if (contentId && new Date(episode.created_at) > cutoffDate) {
          if (!updatesMap[contentId]) {
            updatesMap[contentId] = { hasNewEpisode: false, hasNewSeason: false };
          }
          updatesMap[contentId].hasNewEpisode = true;
        }
      });

      return updatesMap;
    },
    enabled: contentIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
