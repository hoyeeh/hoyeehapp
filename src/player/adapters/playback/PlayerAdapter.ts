/**
 * PlayerAdapter - Unified interface for video playback engines
 * 
 * This abstraction allows swapping between Shaka Player, Video.js, or other engines
 * without modifying the player UI components.
 */

export interface PlayerMetadata {
  title?: string;
  contentId?: string;
  episodeId?: string;
  thumbnail?: string;
  duration?: number;
}

export interface PlayerAdapterOptions {
  videoElement: HTMLVideoElement;
  debug?: boolean;
  preferNative?: boolean; // For Safari native HLS
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  isEnded: boolean;
  isSeeking: boolean;
  currentTime: number;
  duration: number;
  bufferedTime: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  error: PlayerAdapterError | null;
}

export interface PlayerAdapterError {
  code: string;
  message: string;
  severity: 'warning' | 'error' | 'fatal';
  recoverable: boolean;
}

export type PlayerAdapterEventType = 
  | 'play'
  | 'pause'
  | 'playing'
  | 'waiting'
  | 'ended'
  | 'timeupdate'
  | 'durationchange'
  | 'volumechange'
  | 'error'
  | 'loadstart'
  | 'loadedmetadata'
  | 'canplay'
  | 'seeking'
  | 'seeked'
  | 'statechange';

export interface PlayerAdapterEvents {
  play: void;
  pause: void;
  playing: void;
  waiting: void;
  ended: void;
  timeupdate: { currentTime: number; duration: number };
  durationchange: { duration: number };
  volumechange: { volume: number; muted: boolean };
  error: PlayerAdapterError;
  loadstart: { url: string };
  loadedmetadata: { duration: number };
  canplay: void;
  seeking: void;
  seeked: void;
  statechange: PlaybackState;
}

export type PlayerAdapterEventCallback<K extends PlayerAdapterEventType> =
  PlayerAdapterEvents[K] extends void
    ? () => void
    : (data: PlayerAdapterEvents[K]) => void;

export interface PlayerAdapter {
  // Lifecycle
  init(videoElement: HTMLVideoElement, options?: Partial<PlayerAdapterOptions>): Promise<void>;
  destroy(): void;
  
  // Loading
  load(url: string, startTime?: number, metadata?: PlayerMetadata): Promise<boolean>;
  unload(): void;
  
  // Playback controls
  play(): Promise<void>;
  pause(): void;
  seek(time: number): boolean;
  
  // Volume
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  getVolume(): number;
  isMuted(): boolean;
  
  // Playback rate
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  
  // State
  getState(): PlaybackState;
  getCurrentTime(): number;
  getDuration(): number;
  isLoaded(): boolean;
  
  // Events
  on<K extends PlayerAdapterEventType>(event: K, callback: PlayerAdapterEventCallback<K>): void;
  off<K extends PlayerAdapterEventType>(event: K, callback: PlayerAdapterEventCallback<K>): void;
  
  // Capabilities
  supportsHLS(): boolean;
  supportsDASH(): boolean;
  supportsAirPlay(): boolean;
  
  // Engine info
  getEngineName(): string;
  getEngineVersion(): string;
}

/**
 * Factory function type for creating adapters
 */
export type PlayerAdapterFactory = (options?: Partial<PlayerAdapterOptions>) => PlayerAdapter;
