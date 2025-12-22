import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useKidsNearingLimit = () => {
  return useQuery({
    queryKey: ["kids-nearing-limit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, name, daily_time_limit_minutes, time_watched_today_minutes")
        .eq("is_kids", true)
        .not("daily_time_limit_minutes", "is", null)
        .gt("daily_time_limit_minutes", 0);

      if (error) throw error;

      // Filter profiles that have used 80% or more of their daily limit
      const nearingLimit = (data || []).filter((profile) => {
        const limit = profile.daily_time_limit_minutes || 0;
        const watched = profile.time_watched_today_minutes || 0;
        const percentage = limit > 0 ? (watched / limit) * 100 : 0;
        return percentage >= 80;
      });

      return {
        count: nearingLimit.length,
        profiles: nearingLimit.map((p) => ({
          id: p.id,
          name: p.name,
          limit: p.daily_time_limit_minutes,
          watched: p.time_watched_today_minutes,
          percentage: Math.round(
            ((p.time_watched_today_minutes || 0) / (p.daily_time_limit_minutes || 1)) * 100
          ),
        })),
      };
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
};
