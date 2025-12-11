import { useState, useEffect, useCallback } from "react";
import { useProfileContext } from "@/contexts/ProfileContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useKidsTimeLimit = () => {
  const { currentProfile } = useProfileContext();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isTimeLimitReached, setIsTimeLimitReached] = useState(false);

  // Check and reset daily time if needed
  const checkAndResetDailyTime = useCallback(async () => {
    if (!currentProfile?.is_kids) return;

    const today = new Date().toISOString().split("T")[0];
    
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("daily_time_limit_minutes, time_watched_today_minutes, last_time_reset")
      .eq("id", currentProfile.id)
      .maybeSingle();

    if (profile) {
      // Reset time if it's a new day
      if (profile.last_time_reset !== today) {
        await supabase
          .from("user_profiles")
          .update({ 
            time_watched_today_minutes: 0, 
            last_time_reset: today 
          })
          .eq("id", currentProfile.id);
        
        setTimeRemaining(profile.daily_time_limit_minutes ?? null);
        setIsTimeLimitReached(false);
      } else if (profile.daily_time_limit_minutes) {
        const remaining = profile.daily_time_limit_minutes - (profile.time_watched_today_minutes || 0);
        setTimeRemaining(Math.max(0, remaining));
        setIsTimeLimitReached(remaining <= 0);
      } else {
        setTimeRemaining(null);
        setIsTimeLimitReached(false);
      }
    }
  }, [currentProfile]);

  // Increment watched time
  const incrementWatchedTime = useCallback(async (minutes: number) => {
    if (!currentProfile?.is_kids) return;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("daily_time_limit_minutes, time_watched_today_minutes")
      .eq("id", currentProfile.id)
      .maybeSingle();

    if (profile) {
      const newTime = (profile.time_watched_today_minutes || 0) + minutes;
      
      await supabase
        .from("user_profiles")
        .update({ time_watched_today_minutes: newTime })
        .eq("id", currentProfile.id);

      if (profile.daily_time_limit_minutes) {
        const remaining = profile.daily_time_limit_minutes - newTime;
        setTimeRemaining(Math.max(0, remaining));
        
        if (remaining <= 5 && remaining > 0) {
          toast.warning(`Only ${remaining} minutes of watch time left today!`);
        } else if (remaining <= 0) {
          setIsTimeLimitReached(true);
          toast.info("Watch time is over for today! See you tomorrow! 🌟");
        }
      }
    }
  }, [currentProfile]);

  // Log viewing history
  const logViewingHistory = useCallback(async (contentId: string, durationMinutes: number, completed: boolean) => {
    if (!currentProfile?.is_kids) return;

    await supabase
      .from("kids_viewing_history")
      .insert({
        profile_id: currentProfile.id,
        content_id: contentId,
        duration_watched_minutes: durationMinutes,
        completed,
      });
  }, [currentProfile]);

  useEffect(() => {
    checkAndResetDailyTime();
    
    // Check every minute
    const interval = setInterval(checkAndResetDailyTime, 60000);
    return () => clearInterval(interval);
  }, [checkAndResetDailyTime]);

  return {
    timeRemaining,
    isTimeLimitReached,
    incrementWatchedTime,
    logViewingHistory,
    checkAndResetDailyTime,
  };
};
