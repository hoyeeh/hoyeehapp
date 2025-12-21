import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Content } from "@/types";
import { Episode } from "@/hooks/useSeasons";

interface MobileVideoPlayerState {
  isOpen: boolean;
  content: Content | null;
  videoUrl: string;
  title: string;
  episodeTitle?: string;
  episodeId?: string;
  resumeAt?: number;
  introStartTime?: number;
  introEndTime?: number;
  recapStartTime?: number;
  recapEndTime?: number;
  thumbnail?: string;
  hasNextEpisode?: boolean;
  nextEpisode?: Episode | null;
  allEpisodes?: Episode[];
}

interface MobileVideoPlayerContextType {
  playerState: MobileVideoPlayerState;
  openPlayer: (options: {
    content: Content;
    videoUrl: string;
    title: string;
    episodeTitle?: string;
    episodeId?: string;
    resumeAt?: number;
    introStartTime?: number;
    introEndTime?: number;
    recapStartTime?: number;
    recapEndTime?: number;
    thumbnail?: string;
    hasNextEpisode?: boolean;
    nextEpisode?: Episode | null;
    allEpisodes?: Episode[];
  }) => void;
  closePlayer: () => void;
  playNextEpisode: () => void;
  updatePlayerState: (updates: Partial<MobileVideoPlayerState>) => void;
}

const initialState: MobileVideoPlayerState = {
  isOpen: false,
  content: null,
  videoUrl: "",
  title: "",
};

const MobileVideoPlayerContext = createContext<MobileVideoPlayerContextType | null>(null);

export function MobileVideoPlayerProvider({ children }: { children: ReactNode }) {
  const [playerState, setPlayerState] = useState<MobileVideoPlayerState>(initialState);

  const openPlayer = useCallback((options: Omit<MobileVideoPlayerState, "isOpen">) => {
    setPlayerState({
      ...options,
      isOpen: true,
    });
  }, []);

  const closePlayer = useCallback(() => {
    setPlayerState(initialState);
  }, []);

  const playNextEpisode = useCallback(() => {
    if (!playerState.nextEpisode || !playerState.content || !playerState.allEpisodes) return;

    const nextEp = playerState.nextEpisode;
    const currentIndex = playerState.allEpisodes.findIndex(ep => ep.id === nextEp.id);
    
    // Find the episode after this one
    let upcomingNextEpisode: Episode | null = null;
    for (let i = currentIndex + 1; i < playerState.allEpisodes.length; i++) {
      if (playerState.allEpisodes[i].video_url) {
        upcomingNextEpisode = playerState.allEpisodes[i];
        break;
      }
    }

    const epData = nextEp as any;

    setPlayerState(prev => ({
      ...prev,
      videoUrl: nextEp.video_url || "",
      episodeTitle: nextEp.title,
      episodeId: nextEp.id,
      resumeAt: 0,
      introStartTime: epData.intro_start_time ?? undefined,
      introEndTime: epData.intro_end_time ?? undefined,
      recapStartTime: epData.recap_start_time ?? undefined,
      recapEndTime: epData.recap_end_time ?? undefined,
      thumbnail: nextEp.thumbnail_url || undefined,
      nextEpisode: upcomingNextEpisode,
      hasNextEpisode: !!upcomingNextEpisode,
    }));
  }, [playerState.nextEpisode, playerState.content, playerState.allEpisodes]);

  const updatePlayerState = useCallback((updates: Partial<MobileVideoPlayerState>) => {
    setPlayerState(prev => ({ ...prev, ...updates }));
  }, []);

  return (
    <MobileVideoPlayerContext.Provider
      value={{
        playerState,
        openPlayer,
        closePlayer,
        playNextEpisode,
        updatePlayerState,
      }}
    >
      {children}
    </MobileVideoPlayerContext.Provider>
  );
}

export function useMobileVideoPlayer() {
  const context = useContext(MobileVideoPlayerContext);
  if (!context) {
    throw new Error("useMobileVideoPlayer must be used within MobileVideoPlayerProvider");
  }
  return context;
}
