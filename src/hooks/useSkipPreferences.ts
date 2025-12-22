import { useState, useEffect, useCallback } from 'react';

interface SkipPreferences {
  autoSkipIntro: boolean;
  autoSkipRecap: boolean;
  defaultIntroDuration: number; // Duration in seconds for shows without specific intro times
}

const STORAGE_KEY = 'video_skip_preferences';

const defaultPreferences: SkipPreferences = {
  autoSkipIntro: false,
  autoSkipRecap: false,
  defaultIntroDuration: 0, // 0 means disabled
};

export function useSkipPreferences() {
  const [preferences, setPreferences] = useState<SkipPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultPreferences, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[useSkipPreferences] Failed to load preferences:', error);
    }
    return defaultPreferences;
  });

  // Save to localStorage whenever preferences change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('[useSkipPreferences] Failed to save preferences:', error);
    }
  }, [preferences]);

  const setAutoSkipIntro = useCallback((enabled: boolean) => {
    setPreferences(prev => ({ ...prev, autoSkipIntro: enabled }));
  }, []);

  const setAutoSkipRecap = useCallback((enabled: boolean) => {
    setPreferences(prev => ({ ...prev, autoSkipRecap: enabled }));
  }, []);

  const setDefaultIntroDuration = useCallback((duration: number) => {
    setPreferences(prev => ({ ...prev, defaultIntroDuration: Math.max(0, Math.min(300, duration)) }));
  }, []);

  const toggleAutoSkipIntro = useCallback(() => {
    setPreferences(prev => ({ ...prev, autoSkipIntro: !prev.autoSkipIntro }));
  }, []);

  const toggleAutoSkipRecap = useCallback(() => {
    setPreferences(prev => ({ ...prev, autoSkipRecap: !prev.autoSkipRecap }));
  }, []);

  return {
    autoSkipIntro: preferences.autoSkipIntro,
    autoSkipRecap: preferences.autoSkipRecap,
    defaultIntroDuration: preferences.defaultIntroDuration,
    setAutoSkipIntro,
    setAutoSkipRecap,
    setDefaultIntroDuration,
    toggleAutoSkipIntro,
    toggleAutoSkipRecap,
  };
}
