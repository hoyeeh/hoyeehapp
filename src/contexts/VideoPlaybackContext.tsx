import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface VideoPlaybackState {
  isVideoPlaying: boolean;
  videoTitle: string | null;
  contentId: string | null;
}

interface VideoPlaybackContextType {
  state: VideoPlaybackState;
  startVideoPlayback: (contentId: string, title: string) => void;
  stopVideoPlayback: () => void;
  isVideoActive: () => boolean;
}

const VideoPlaybackContext = createContext<VideoPlaybackContextType | undefined>(undefined);

export function VideoPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VideoPlaybackState>({
    isVideoPlaying: false,
    videoTitle: null,
    contentId: null,
  });
  
  const stateRef = useRef(state);
  stateRef.current = state;

  const startVideoPlayback = useCallback((contentId: string, title: string) => {
    console.log('[VideoPlayback] Starting video:', title);
    setState({
      isVideoPlaying: true,
      videoTitle: title,
      contentId,
    });
  }, []);

  const stopVideoPlayback = useCallback(() => {
    console.log('[VideoPlayback] Stopping video');
    setState({
      isVideoPlaying: false,
      videoTitle: null,
      contentId: null,
    });
  }, []);

  const isVideoActive = useCallback(() => {
    return stateRef.current.isVideoPlaying;
  }, []);

  // Prevent accidental page exit during playback
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stateRef.current.isVideoPlaying) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <VideoPlaybackContext.Provider value={{ state, startVideoPlayback, stopVideoPlayback, isVideoActive }}>
      {children}
    </VideoPlaybackContext.Provider>
  );
}

export function useVideoPlayback() {
  const context = useContext(VideoPlaybackContext);
  if (context === undefined) {
    throw new Error('useVideoPlayback must be used within a VideoPlaybackProvider');
  }
  return context;
}

// Optional hook for components that may be outside the provider
export function useVideoPlaybackSafe() {
  const context = useContext(VideoPlaybackContext);
  return context;
}
