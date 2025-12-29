import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SubtitleTrack {
  id: string;
  language: string;
  languageCode: string;
  label: string;
  url: string;
  isDefault?: boolean;
}

export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface SubtitleState {
  isLoading: boolean;
  tracks: SubtitleTrack[];
  activeTrack: SubtitleTrack | null;
  currentCue: SubtitleCue | null;
  error: string | null;
}

// Parse WebVTT file
function parseVTT(vttContent: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = vttContent.trim().split('\n');
  
  let i = 0;
  
  // Skip header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Look for timestamp line
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map(s => s.trim().split(' ')[0]);
      
      const startTime = parseTimestamp(startStr);
      const endTime = parseTimestamp(endStr);
      
      // Collect text lines
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }
      
      if (textLines.length > 0) {
        cues.push({
          id: `cue-${cues.length}`,
          startTime,
          endTime,
          text: textLines.join('\n'),
        });
      }
    } else {
      i++;
    }
  }
  
  return cues;
}

// Parse SRT file
function parseSRT(srtContent: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = srtContent.trim().split(/\n\n+/);
  
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;
    
    // Skip the index line
    const timeLine = lines[1];
    if (!timeLine.includes('-->')) continue;
    
    const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
    const startTime = parseTimestamp(startStr.replace(',', '.'));
    const endTime = parseTimestamp(endStr.replace(',', '.'));
    
    const text = lines.slice(2).join('\n');
    
    cues.push({
      id: `cue-${cues.length}`,
      startTime,
      endTime,
      text,
    });
  }
  
  return cues;
}

// Parse timestamp string to seconds
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':');
  
  if (parts.length === 3) {
    const [hours, minutes, secondsMs] = parts;
    const [seconds, ms] = secondsMs.split(/[.,]/);
    return (
      parseInt(hours) * 3600 +
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      (parseInt(ms || '0') / 1000)
    );
  } else if (parts.length === 2) {
    const [minutes, secondsMs] = parts;
    const [seconds, ms] = secondsMs.split(/[.,]/);
    return (
      parseInt(minutes) * 60 +
      parseInt(seconds) +
      (parseInt(ms || '0') / 1000)
    );
  }
  
  return 0;
}

// Language code to display label mapping
const LANGUAGE_LABELS: Record<string, string> = {
  fra: 'Français',
  eng: 'English',
  spa: 'Español',
  ara: 'العربية',
  deu: 'Deutsch',
  ita: 'Italiano',
  por: 'Português',
  hin: 'हिन्दी',
  zho: '中文',
  jpn: '日本語',
  // Legacy codes for backward compatibility
  fr: 'Français',
  en: 'English',
  es: 'Español',
  yo: 'Yorùbá',
  ha: 'Hausa',
  ig: 'Igbo',
};

export function useSubtitles(contentId: string, episodeId?: string) {
  const [state, setState] = useState<SubtitleState>({
    isLoading: false,
    tracks: [],
    activeTrack: null,
    currentCue: null,
    error: null,
  });
  
  const cuesRef = useRef<SubtitleCue[]>([]);
  const lastCueIndexRef = useRef(-1);
  const currentCueIdRef = useRef<string | null>(null);
  
  // Fetch available subtitle tracks from database
  const fetchSubtitleTracks = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Query subtitles from database
      let query = supabase
        .from('subtitles')
        .select('*')
        .eq('content_id', contentId);
      
      if (episodeId) {
        query = query.eq('episode_id', episodeId);
      } else {
        query = query.is('episode_id', null);
      }
      
      const { data: subtitles, error } = await query;
      
      if (error) {
        console.error('[Subtitles] Database error:', error);
        // Fall back to legacy storage check
        return fetchLegacySubtitles();
      }
      
      if (subtitles && subtitles.length > 0) {
        const tracks: SubtitleTrack[] = subtitles.map((sub) => ({
          id: sub.id,
          language: sub.language_label,
          languageCode: sub.language_code,
          label: LANGUAGE_LABELS[sub.language_code] || sub.language_label,
          url: sub.cdn_url || sub.subtitle_url,
          isDefault: sub.language_code === 'eng' || sub.language_code === 'fra',
        }));
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          tracks,
          activeTrack: tracks.find(t => t.isDefault) || null,
        }));
        
        // Load the default track's cues
        const defaultTrack = tracks.find(t => t.isDefault);
        if (defaultTrack) {
          loadSubtitleCues(defaultTrack);
        }
      } else {
        // No subtitles in database, try legacy storage
        await fetchLegacySubtitles();
      }
    } catch (error) {
      console.error('[Subtitles] Failed to fetch tracks:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load subtitles',
      }));
    }
  }, [contentId, episodeId]);
  
  // Legacy fallback for subtitles stored directly in storage
  const fetchLegacySubtitles = async () => {
    const baseId = episodeId || contentId;
    const possibleLanguages = [
      { code: 'eng', label: 'English' },
      { code: 'fra', label: 'Français' },
      { code: 'spa', label: 'Español' },
      { code: 'ara', label: 'العربية' },
      // Legacy codes
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
      { code: 'es', label: 'Español' },
    ];
    
    const foundTracks: SubtitleTrack[] = [];
    
    // Try to find subtitle files in storage
    for (const lang of possibleLanguages) {
      const subtitlePath = `subtitles/${baseId}/${lang.code}.vtt`;
      const { data } = await supabase.storage
        .from('videos')
        .createSignedUrl(subtitlePath, 3600);
      
      if (data?.signedUrl) {
        foundTracks.push({
          id: `${baseId}-${lang.code}`,
          language: lang.label,
          languageCode: lang.code,
          label: lang.label,
          url: data.signedUrl,
          isDefault: lang.code === 'eng' || lang.code === 'en',
        });
      }
    }
    
    setState(prev => ({
      ...prev,
      isLoading: false,
      tracks: foundTracks,
      activeTrack: foundTracks.find(t => t.isDefault) || null,
    }));
    
    // Load the default track's cues
    const defaultTrack = foundTracks.find(t => t.isDefault);
    if (defaultTrack) {
      loadSubtitleCues(defaultTrack);
    }
  };
  
  // Load subtitle cues from URL
  const loadSubtitleCues = useCallback(async (track: SubtitleTrack) => {
    try {
      const response = await fetch(track.url);
      if (!response.ok) throw new Error('Failed to fetch subtitle file');
      
      const content = await response.text();
      
      // Detect format and parse
      const cues = track.url.includes('.srt') 
        ? parseSRT(content) 
        : parseVTT(content);
      
      cuesRef.current = cues;
      lastCueIndexRef.current = -1;
      
      console.log(`[Subtitles] Loaded ${cues.length} cues for ${track.language}`);
    } catch (error) {
      console.error('[Subtitles] Failed to load cues:', error);
      cuesRef.current = [];
    }
  }, []);
  
  // Select a subtitle track
  const selectTrack = useCallback((track: SubtitleTrack | null) => {
    currentCueIdRef.current = null;
    setState(prev => ({ ...prev, activeTrack: track, currentCue: null }));
    
    if (track) {
      loadSubtitleCues(track);
      localStorage.setItem('preferred_subtitle_language', track.languageCode);
    } else {
      cuesRef.current = [];
      localStorage.removeItem('preferred_subtitle_language');
    }
  }, [loadSubtitleCues]);
  
  // Update current cue based on video time
  const updateCurrentCue = useCallback((currentTime: number) => {
    const cues = cuesRef.current;
    if (!cues.length) {
      if (currentCueIdRef.current !== null) {
        currentCueIdRef.current = null;
        setState(prev => ({ ...prev, currentCue: null }));
      }
      return;
    }
    
    // Binary search for efficiency on large subtitle files
    let left = 0;
    let right = cues.length - 1;
    let foundCue: SubtitleCue | null = null;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const cue = cues[mid];
      
      if (currentTime >= cue.startTime && currentTime <= cue.endTime) {
        foundCue = cue;
        break;
      } else if (currentTime < cue.startTime) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    
    const foundCueId = foundCue?.id ?? null;
    
    // Only update if the cue has changed (uses ref to avoid stale closure)
    if (foundCueId !== currentCueIdRef.current) {
      currentCueIdRef.current = foundCueId;
      setState(prev => ({ ...prev, currentCue: foundCue }));
    }
  }, []);
  
  // Load preferred language on mount
  useEffect(() => {
    const preferredLang = localStorage.getItem('preferred_subtitle_language');
    if (preferredLang && state.tracks.length > 0) {
      const track = state.tracks.find(t => t.languageCode === preferredLang);
      if (track && !state.activeTrack) {
        selectTrack(track);
      }
    }
  }, [state.tracks, state.activeTrack, selectTrack]);
  
  // Fetch tracks on mount
  useEffect(() => {
    fetchSubtitleTracks();
  }, [fetchSubtitleTracks]);
  
  return {
    ...state,
    selectTrack,
    updateCurrentCue,
    hasSubtitles: state.tracks.length > 0,
    isSubtitlesEnabled: state.activeTrack !== null,
  };
}
