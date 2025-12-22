import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "youtube_video_progress";

interface VideoProgress {
  [videoId: string]: {
    progress: number; // in seconds
    duration: number;
    lastWatched: string;
  };
}

export function useYouTubeVideoProgress() {
  const [progressMap, setProgressMap] = useState<VideoProgress>({});

  // Load progress from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProgressMap(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load video progress:", error);
    }
  }, []);

  // Save progress to localStorage
  const saveToStorage = useCallback((data: VideoProgress) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save video progress:", error);
    }
  }, []);

  // Save progress for a video
  const saveProgress = useCallback((videoId: string, progress: number, duration: number) => {
    setProgressMap(prev => {
      const updated = {
        ...prev,
        [videoId]: {
          progress,
          duration,
          lastWatched: new Date().toISOString(),
        },
      };
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Get progress for a video
  const getProgress = useCallback((videoId: string): number => {
    return progressMap[videoId]?.progress || 0;
  }, [progressMap]);

  // Get progress percentage for a video
  const getProgressPercent = useCallback((videoId: string): number => {
    const data = progressMap[videoId];
    if (!data || data.duration === 0) return 0;
    return Math.min(100, Math.round((data.progress / data.duration) * 100));
  }, [progressMap]);

  // Clear progress for a video
  const clearProgress = useCallback((videoId: string) => {
    setProgressMap(prev => {
      const updated = { ...prev };
      delete updated[videoId];
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Clear old progress (older than 30 days)
  const clearOldProgress = useCallback(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    setProgressMap(prev => {
      const updated: VideoProgress = {};
      Object.entries(prev).forEach(([videoId, data]) => {
        if (new Date(data.lastWatched) > thirtyDaysAgo) {
          updated[videoId] = data;
        }
      });
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Clean up old progress on mount
  useEffect(() => {
    clearOldProgress();
  }, [clearOldProgress]);

  return {
    saveProgress,
    getProgress,
    getProgressPercent,
    clearProgress,
    progressMap,
  };
}
