import { PlayerError } from '../utils/errors';

export interface PlayerMetadata {
  title?: string;
  thumbnail?: string;
  contentId?: string;
  episodeId?: string;
  [key: string]: unknown;
}

export interface PlayerState {
  // URL state
  currentUrl: string | null;
  loadedUrl: string | null;
  pendingUrl: string | null;
  
  // Load protection
  isLoading: boolean;
  loadLock: boolean;
  lastLoadTime: number;
  lastLoadUrl: string | null;
  
  // Seek protection
  lastSeekTime: number;
  seekCooldown: boolean;
  
  // Playback state
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  playbackRate: number;
  
  // Time state
  currentTime: number;
  duration: number;
  bufferedProgress: number;
  
  // Error state
  error: PlayerError | null;
  
  // Metadata
  metadata: PlayerMetadata | null;
  
  // Readiness
  isReady: boolean;
  isMetadataLoaded: boolean;
}

export const initialPlayerState: PlayerState = {
  currentUrl: null,
  loadedUrl: null,
  pendingUrl: null,
  
  isLoading: false,
  loadLock: false,
  lastLoadTime: 0,
  lastLoadUrl: null,
  
  lastSeekTime: 0,
  seekCooldown: false,
  
  isPlaying: false,
  isPaused: true,
  isBuffering: false,
  isMuted: true, // Start muted for autoplay compliance
  volume: 1,
  playbackRate: 1,
  
  currentTime: 0,
  duration: 0,
  bufferedProgress: 0,
  
  error: null,
  
  metadata: null,
  
  isReady: false,
  isMetadataLoaded: false,
};

export type PlayerStateListener = (state: PlayerState) => void;

/**
 * Create a player state store with subscription support
 */
export function createPlayerStore(initialState: PlayerState = initialPlayerState) {
  let state = { ...initialState };
  const listeners = new Set<PlayerStateListener>();

  const notify = () => {
    listeners.forEach(listener => listener(state));
  };

  return {
    getState(): PlayerState {
      return state;
    },

    setState(partial: Partial<PlayerState>): void {
      state = { ...state, ...partial };
      notify();
    },

    subscribe(listener: PlayerStateListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    reset(): void {
      state = { ...initialPlayerState };
      notify();
    },

    // Convenience methods
    setLoading(isLoading: boolean): void {
      this.setState({ isLoading, isBuffering: isLoading });
    },

    setError(error: PlayerError | null): void {
      this.setState({ error, isLoading: false });
    },

    setPlaybackState(isPlaying: boolean): void {
      this.setState({ 
        isPlaying, 
        isPaused: !isPlaying,
        isBuffering: false 
      });
    },

    setTime(currentTime: number, duration?: number): void {
      const update: Partial<PlayerState> = { currentTime };
      if (duration !== undefined) {
        update.duration = duration;
      }
      this.setState(update);
    },

    setVolume(volume: number, isMuted?: boolean): void {
      const update: Partial<PlayerState> = { volume };
      if (isMuted !== undefined) {
        update.isMuted = isMuted;
      }
      this.setState(update);
    },

    // Load protection helpers
    canLoad(url: string): boolean {
      const now = Date.now();
      const LOAD_COOLDOWN_MS = 4000;
      
      // Don't load if already loading
      if (state.loadLock) {
        return false;
      }
      
      // Don't reload same URL within cooldown
      if (
        state.lastLoadUrl === url && 
        now - state.lastLoadTime < LOAD_COOLDOWN_MS
      ) {
        return false;
      }
      
      return true;
    },

    startLoad(url: string): void {
      this.setState({
        loadLock: true,
        isLoading: true,
        pendingUrl: url,
        error: null,
      });
    },

    finishLoad(url: string, success: boolean): void {
      if (success) {
        this.setState({
          loadLock: false,
          isLoading: false,
          loadedUrl: url,
          currentUrl: url,
          pendingUrl: null,
          lastLoadTime: Date.now(),
          lastLoadUrl: url,
        });
      } else {
        this.setState({
          loadLock: false,
          isLoading: false,
          pendingUrl: null,
        });
      }
    },

    // Seek protection helpers
    canSeek(): boolean {
      const now = Date.now();
      const SEEK_RATE_LIMIT_MS = 800;
      return now - state.lastSeekTime >= SEEK_RATE_LIMIT_MS;
    },

    recordSeek(): void {
      this.setState({ lastSeekTime: Date.now() });
    },
  };
}

export type PlayerStore = ReturnType<typeof createPlayerStore>;
