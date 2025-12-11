import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Content } from "@/types";

interface MiniPlayerState {
  content: Content | null;
  src: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isActive: boolean;
}

interface MiniPlayerContextType {
  state: MiniPlayerState;
  minimize: (content: Content, src: string, currentTime: number, duration: number) => void;
  restore: () => { content: Content; progress: number } | null;
  close: () => void;
  updateTime: (currentTime: number) => void;
  setPlaying: (isPlaying: boolean) => void;
}

const initialState: MiniPlayerState = {
  content: null,
  src: "",
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isActive: false,
};

const MiniPlayerContext = createContext<MiniPlayerContextType | null>(null);

export function MiniPlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MiniPlayerState>(initialState);

  const minimize = useCallback((content: Content, src: string, currentTime: number, duration: number) => {
    setState({
      content,
      src,
      currentTime,
      duration,
      isPlaying: true,
      isActive: true,
    });
  }, []);

  const restore = useCallback(() => {
    if (!state.content) return null;
    const result = { content: state.content, progress: state.currentTime };
    setState(initialState);
    return result;
  }, [state.content, state.currentTime]);

  const close = useCallback(() => {
    setState(initialState);
  }, []);

  const updateTime = useCallback((currentTime: number) => {
    setState((prev) => ({ ...prev, currentTime }));
  }, []);

  const setPlaying = useCallback((isPlaying: boolean) => {
    setState((prev) => ({ ...prev, isPlaying }));
  }, []);

  return (
    <MiniPlayerContext.Provider value={{ state, minimize, restore, close, updateTime, setPlaying }}>
      {children}
    </MiniPlayerContext.Provider>
  );
}

export function useMiniPlayer() {
  const context = useContext(MiniPlayerContext);
  if (!context) {
    throw new Error("useMiniPlayer must be used within MiniPlayerProvider");
  }
  return context;
}
