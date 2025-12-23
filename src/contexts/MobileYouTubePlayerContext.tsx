import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail?: string;
}

interface MobileYouTubePlayerState {
  isOpen: boolean;
  video: YouTubeVideo | null;
}

interface MobileYouTubePlayerContextType {
  state: MobileYouTubePlayerState;
  openPlayer: (video: YouTubeVideo) => void;
  closePlayer: () => void;
}

const initialState: MobileYouTubePlayerState = {
  isOpen: false,
  video: null,
};

const MobileYouTubePlayerContext = createContext<MobileYouTubePlayerContextType | undefined>(undefined);

export const MobileYouTubePlayerProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<MobileYouTubePlayerState>(initialState);

  const openPlayer = useCallback((video: YouTubeVideo) => {
    setState({
      isOpen: true,
      video,
    });
  }, []);

  const closePlayer = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <MobileYouTubePlayerContext.Provider value={{ state, openPlayer, closePlayer }}>
      {children}
    </MobileYouTubePlayerContext.Provider>
  );
};

export const useMobileYouTubePlayer = () => {
  const context = useContext(MobileYouTubePlayerContext);
  if (!context) {
    throw new Error('useMobileYouTubePlayer must be used within a MobileYouTubePlayerProvider');
  }
  return context;
};
