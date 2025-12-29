import { useState, useEffect, useCallback } from 'react';

export type SubtitleFontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type SubtitleFontStyle = 'default' | 'serif' | 'mono' | 'casual';

interface SubtitleSettings {
  fontSize: SubtitleFontSize;
  fontStyle: SubtitleFontStyle;
  backgroundColor: string;
  textColor: string;
}

const DEFAULT_SETTINGS: SubtitleSettings = {
  fontSize: 'medium',
  fontStyle: 'default',
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  textColor: '#ffffff',
};

const STORAGE_KEY = 'subtitle_display_settings';

export function useSubtitleSettings() {
  const [settings, setSettings] = useState<SubtitleSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('[SubtitleSettings] Failed to load settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('[SubtitleSettings] Failed to save settings:', e);
    }
  }, [settings]);

  const updateFontSize = useCallback((fontSize: SubtitleFontSize) => {
    setSettings(prev => ({ ...prev, fontSize }));
  }, []);

  const updateFontStyle = useCallback((fontStyle: SubtitleFontStyle) => {
    setSettings(prev => ({ ...prev, fontStyle }));
  }, []);

  const updateBackgroundColor = useCallback((backgroundColor: string) => {
    setSettings(prev => ({ ...prev, backgroundColor }));
  }, []);

  const updateTextColor = useCallback((textColor: string) => {
    setSettings(prev => ({ ...prev, textColor }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Get CSS classes based on settings
  const getFontSizeClass = useCallback(() => {
    switch (settings.fontSize) {
      case 'small': return 'text-sm sm:text-base';
      case 'medium': return 'text-base sm:text-lg';
      case 'large': return 'text-lg sm:text-xl';
      case 'xlarge': return 'text-xl sm:text-2xl';
      default: return 'text-base sm:text-lg';
    }
  }, [settings.fontSize]);

  const getFontStyleClass = useCallback(() => {
    switch (settings.fontStyle) {
      case 'default': return 'font-sans';
      case 'serif': return 'font-serif';
      case 'mono': return 'font-mono';
      case 'casual': return 'font-sans italic';
      default: return 'font-sans';
    }
  }, [settings.fontStyle]);

  return {
    settings,
    updateFontSize,
    updateFontStyle,
    updateBackgroundColor,
    updateTextColor,
    resetToDefaults,
    getFontSizeClass,
    getFontStyleClass,
  };
}
