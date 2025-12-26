import { createPlayerStore, PlayerStore, PlayerMetadata, PlayerState } from './state/playerStore';
import { createMp4Source, SourceHandler } from './sources/Mp4Source';
import { createHlsSource, loadHlsJs } from './sources/HlsSource';
import { PlayerError, PlayerErrorCode, createPlayerError, mapMediaError } from './utils/errors';
import { createRateLimiter } from './utils/throttle';
import { calculateBufferedProgress, shouldSeek, clamp } from './utils/time';

export type PlayerPlatform = 'desktop' | 'mobile' | 'tv' | 'kids';

export interface PlayerEventMap {
  play: void;
  pause: void;
  playing: void;
  waiting: void;
  ended: void;
  timeupdate: { currentTime: number; duration: number };
  durationchange: { duration: number };
  volumechange: { volume: number; muted: boolean };
  error: PlayerError;
  loadstart: { url: string };
  loadedmetadata: { duration: number };
  canplay: void;
  seeking: void;
  seeked: void;
  statechange: PlayerState;
}

export type PlayerEventCallback<K extends keyof PlayerEventMap> = 
  PlayerEventMap[K] extends void 
    ? () => void 
    : (data: PlayerEventMap[K]) => void;

export interface PlayerOptions {
  videoEl: HTMLVideoElement;
  platform?: PlayerPlatform;
  debug?: boolean;
  onEvent?: <K extends keyof PlayerEventMap>(event: K, data?: PlayerEventMap[K]) => void;
  // Idempotency settings
  loadCooldownMs?: number;
  seekRateLimitMs?: number;
  driftThreshold?: number;
}

export interface PlayerInstance {
  // Core API
  load(url: string, startTime?: number, metadata?: PlayerMetadata): Promise<boolean>;
  play(): Promise<void>;
  pause(): void;
  seek(time: number): boolean;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  destroy(): void;
  
  // State access
  getState(): PlayerState;
  subscribe(callback: (state: PlayerState) => void): () => void;
  
  // Utilities
  isUrlLoaded(url: string): boolean;
  canLoad(url: string): boolean;
  canSeek(): boolean;
}

const DEBUG_KEY = 'HOYEEH_DEBUG';

function isDebugEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

function debugLog(message: string, ...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log(`[PlayerEngine] ${message}`, ...args);
  }
}

/**
 * Create a unified Hoyeeh Player instance
 */
export function createPlayer(options: PlayerOptions): PlayerInstance {
  const {
    videoEl,
    platform = 'desktop',
    debug = false,
    onEvent,
    loadCooldownMs = 4000,
    seekRateLimitMs = 800,
    driftThreshold = 1.5,
  } = options;

  // State store
  const store = createPlayerStore();

  // Source handlers
  const mp4Source = createMp4Source();
  const hlsSource = createHlsSource();
  let activeSource: SourceHandler | null = null;

  // Rate limiters
  const seekLimiter = createRateLimiter(seekRateLimitMs);

  // Event emitter
  const emit = <K extends keyof PlayerEventMap>(event: K, data?: PlayerEventMap[K]) => {
    if (onEvent) {
      onEvent(event, data);
    }
    if (debug || isDebugEnabled()) {
      debugLog(`Event: ${event}`, data);
    }
  };

  // Attach video element listeners
  const attachVideoListeners = () => {
    const handlePlay = () => {
      store.setPlaybackState(true);
      emit('play');
    };

    const handlePause = () => {
      store.setPlaybackState(false);
      emit('pause');
    };

    const handlePlaying = () => {
      store.setState({ isBuffering: false, isPlaying: true });
      emit('playing');
    };

    const handleWaiting = () => {
      store.setState({ isBuffering: true });
      emit('waiting');
    };

    const handleEnded = () => {
      store.setPlaybackState(false);
      emit('ended');
    };

    const handleTimeUpdate = () => {
      const currentTime = videoEl.currentTime;
      const duration = videoEl.duration || 0;
      const bufferedProgress = calculateBufferedProgress(
        videoEl.buffered,
        currentTime,
        duration
      );
      
      store.setTime(currentTime, duration);
      store.setState({ bufferedProgress });
      emit('timeupdate', { currentTime, duration });
    };

    const handleDurationChange = () => {
      const duration = videoEl.duration || 0;
      store.setState({ duration, isMetadataLoaded: true });
      emit('durationchange', { duration });
    };

    const handleVolumeChange = () => {
      store.setVolume(videoEl.volume, videoEl.muted);
      emit('volumechange', { volume: videoEl.volume, muted: videoEl.muted });
    };

    const handleError = () => {
      const error = mapMediaError(videoEl.error);
      store.setError(error);
      emit('error', error);
    };

    const handleLoadedMetadata = () => {
      store.setState({ 
        isMetadataLoaded: true, 
        duration: videoEl.duration,
        isReady: true,
      });
      emit('loadedmetadata', { duration: videoEl.duration });
    };

    const handleCanPlay = () => {
      store.setState({ isReady: true, isBuffering: false });
      emit('canplay');
    };

    const handleSeeking = () => {
      emit('seeking');
    };

    const handleSeeked = () => {
      emit('seeked');
    };

    // Attach all listeners
    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('pause', handlePause);
    videoEl.addEventListener('playing', handlePlaying);
    videoEl.addEventListener('waiting', handleWaiting);
    videoEl.addEventListener('ended', handleEnded);
    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    videoEl.addEventListener('durationchange', handleDurationChange);
    videoEl.addEventListener('volumechange', handleVolumeChange);
    videoEl.addEventListener('error', handleError);
    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoEl.addEventListener('canplay', handleCanPlay);
    videoEl.addEventListener('seeking', handleSeeking);
    videoEl.addEventListener('seeked', handleSeeked);

    // Return cleanup function
    return () => {
      videoEl.removeEventListener('play', handlePlay);
      videoEl.removeEventListener('pause', handlePause);
      videoEl.removeEventListener('playing', handlePlaying);
      videoEl.removeEventListener('waiting', handleWaiting);
      videoEl.removeEventListener('ended', handleEnded);
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('durationchange', handleDurationChange);
      videoEl.removeEventListener('volumechange', handleVolumeChange);
      videoEl.removeEventListener('error', handleError);
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.removeEventListener('canplay', handleCanPlay);
      videoEl.removeEventListener('seeking', handleSeeking);
      videoEl.removeEventListener('seeked', handleSeeked);
    };
  };

  const cleanupListeners = attachVideoListeners();

  // Subscribe to state changes for external notification
  store.subscribe((state) => {
    emit('statechange', state);
  });

  // Initialize video element state
  videoEl.muted = true; // Start muted for autoplay compliance

  const player: PlayerInstance = {
    async load(url: string, startTime?: number, metadata?: PlayerMetadata): Promise<boolean> {
      if (!url) {
        debugLog('Load rejected: empty URL');
        return false;
      }

      // Check if we can load (cooldown + lock protection)
      if (!store.canLoad(url)) {
        debugLog('Load rejected: cooldown or lock active', { url });
        return false;
      }

      // Don't reload if URL is already loaded
      if (store.getState().loadedUrl === url) {
        debugLog('Load skipped: URL already loaded', { url });
        // Still seek to start time if different
        if (startTime !== undefined && shouldSeek(videoEl.currentTime, startTime, driftThreshold)) {
          player.seek(startTime);
        }
        return true;
      }

      debugLog('Loading video', { url, startTime, metadata });
      store.startLoad(url);
      store.setState({ metadata: metadata || null });
      emit('loadstart', { url });

      // Select appropriate source handler
      let source: SourceHandler;
      if (hlsSource.canPlay(url)) {
        // Ensure HLS.js is loaded
        await loadHlsJs();
        source = hlsSource;
      } else if (mp4Source.canPlay(url)) {
        source = mp4Source;
      } else {
        // Default to MP4 source for unknown URLs
        source = mp4Source;
      }

      // Destroy previous source
      if (activeSource && activeSource !== source) {
        activeSource.destroy();
      }
      activeSource = source;

      // Load the video
      const result = await source.load(videoEl, url, startTime);

      if (result.success) {
        store.finishLoad(url, true);
        debugLog('Load successful', { url });
        
        // Attempt autoplay (muted)
        try {
          await videoEl.play();
        } catch (e) {
          debugLog('Autoplay blocked', e);
        }
        
        return true;
      } else {
        store.finishLoad(url, false);
        if (result.error) {
          store.setError(result.error);
          emit('error', result.error);
        }
        debugLog('Load failed', { url, error: result.error });
        return false;
      }
    },

    async play(): Promise<void> {
      try {
        await videoEl.play();
      } catch (error) {
        debugLog('Play failed', error);
        // If autoplay blocked, try muted
        if (!videoEl.muted) {
          videoEl.muted = true;
          store.setState({ isMuted: true });
          try {
            await videoEl.play();
          } catch (e) {
            debugLog('Muted play also failed', e);
          }
        }
      }
    },

    pause(): void {
      videoEl.pause();
    },

    seek(time: number): boolean {
      if (!store.canSeek()) {
        debugLog('Seek rejected: rate limited');
        return false;
      }

      const duration = videoEl.duration || 0;
      if (duration <= 0) {
        debugLog('Seek rejected: no duration');
        return false;
      }

      const clampedTime = clamp(time, 0, duration);
      
      // Check drift threshold
      if (!shouldSeek(videoEl.currentTime, clampedTime, driftThreshold)) {
        debugLog('Seek skipped: within drift threshold');
        return false;
      }

      store.recordSeek();
      videoEl.currentTime = clampedTime;
      debugLog('Seek executed', { to: clampedTime });
      return true;
    },

    setVolume(volume: number): void {
      const clampedVolume = clamp(volume, 0, 1);
      videoEl.volume = clampedVolume;
      if (clampedVolume > 0 && videoEl.muted) {
        videoEl.muted = false;
      }
    },

    setMuted(muted: boolean): void {
      videoEl.muted = muted;
    },

    setPlaybackRate(rate: number): void {
      const clampedRate = clamp(rate, 0.25, 4);
      videoEl.playbackRate = clampedRate;
      store.setState({ playbackRate: clampedRate });
    },

    destroy(): void {
      debugLog('Destroying player');
      cleanupListeners();
      if (activeSource) {
        activeSource.destroy();
        activeSource = null;
      }
      store.reset();
    },

    getState(): PlayerState {
      return store.getState();
    },

    subscribe(callback: (state: PlayerState) => void): () => void {
      return store.subscribe(callback);
    },

    isUrlLoaded(url: string): boolean {
      return store.getState().loadedUrl === url;
    },

    canLoad(url: string): boolean {
      return store.canLoad(url);
    },

    canSeek(): boolean {
      return store.canSeek();
    },
  };

  return player;
}

export type { PlayerState, PlayerMetadata };
