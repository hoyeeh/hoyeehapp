import { useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UseWatchProgressOptions {
  contentId: string;
  onProgressLoaded?: (progress: number) => void;
}

export const useWatchProgress = ({ contentId, onProgressLoaded }: UseWatchProgressOptions) => {
  const { user } = useAuth();
  const lastSavedProgress = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial progress
  useEffect(() => {
    const loadProgress = async () => {
      if (!user || !contentId) return;

      const { data, error } = await supabase
        .from("watch_history")
        .select("progress")
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .maybeSingle();

      if (!error && data?.progress) {
        lastSavedProgress.current = data.progress;
        onProgressLoaded?.(data.progress);
      }
    };

    loadProgress();
  }, [user, contentId, onProgressLoaded]);

  const saveProgress = useCallback(async (currentTime: number, duration: number) => {
    if (!user || !contentId || duration === 0) return;

    const progressPercent = Math.floor((currentTime / duration) * 100);
    
    // Only save if progress changed by at least 1%
    if (Math.abs(progressPercent - lastSavedProgress.current) < 1) return;

    lastSavedProgress.current = progressPercent;

    try {
      const { error } = await supabase
        .from("watch_history")
        .upsert(
          {
            user_id: user.id,
            content_id: contentId,
            progress: Math.floor(currentTime), // Store in seconds
            last_watched: new Date().toISOString(),
          },
          { onConflict: "user_id,content_id" }
        );

      if (error) {
        console.error("Failed to save watch progress:", error);
      }
    } catch (err) {
      console.error("Error saving progress:", err);
    }
  }, [user, contentId]);

  const scheduleProgressSave = useCallback((currentTime: number, duration: number) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule save after 10 seconds of playback
    saveTimeoutRef.current = setTimeout(() => {
      saveProgress(currentTime, duration);
    }, 10000);
  }, [saveProgress]);

  const saveProgressImmediately = useCallback((currentTime: number, duration: number) => {
    // Clear any pending saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    saveProgress(currentTime, duration);
  }, [saveProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    saveProgress,
    scheduleProgressSave,
    saveProgressImmediately,
  };
};
