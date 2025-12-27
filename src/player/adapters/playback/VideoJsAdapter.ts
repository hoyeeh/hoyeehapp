/**
 * VideoJsAdapter - Video.js implementation of PlayerAdapter (Placeholder)
 * 
 * This is a placeholder for future Video.js integration.
 * To enable: install video.js package and implement the adapter.
 */

import {
  PlayerAdapter,
  PlayerAdapterOptions,
  PlayerMetadata,
  PlaybackState,
  PlayerAdapterEventType,
  PlayerAdapterEventCallback,
} from './PlayerAdapter';

/**
 * Placeholder Video.js adapter factory
 * 
 * To implement:
 * 1. Install video.js: npm install video.js
 * 2. Import videojs from 'video.js'
 * 3. Implement all PlayerAdapter methods using Video.js API
 */
export function createVideoJsAdapter(_options?: Partial<PlayerAdapterOptions>): PlayerAdapter {
  console.warn('[VideoJsAdapter] This is a placeholder. Video.js adapter is not yet implemented.');
  
  const notImplemented = (): never => {
    throw new Error('VideoJsAdapter is not implemented. Use ShakaAdapter instead.');
  };

  const emptyState: PlaybackState = {
    isPlaying: false,
    isPaused: true,
    isBuffering: false,
    isEnded: false,
    isSeeking: false,
    currentTime: 0,
    duration: 0,
    bufferedTime: 0,
    volume: 1,
    muted: true,
    playbackRate: 1,
    error: null,
  };

  return {
    async init(): Promise<void> {
      throw new Error('VideoJsAdapter is not implemented');
    },
    destroy(): void {
      // No-op
    },
    async load(): Promise<boolean> {
      throw new Error('VideoJsAdapter is not implemented');
    },
    unload(): void {
      // No-op
    },
    async play(): Promise<void> {
      throw new Error('VideoJsAdapter is not implemented');
    },
    pause(): void {
      // No-op
    },
    seek(): boolean {
      return false;
    },
    setVolume(): void {
      // No-op
    },
    setMuted(): void {
      // No-op
    },
    getVolume(): number {
      return 0;
    },
    isMuted(): boolean {
      return true;
    },
    setPlaybackRate(): void {
      // No-op
    },
    getPlaybackRate(): number {
      return 1;
    },
    getState(): PlaybackState {
      return emptyState;
    },
    getCurrentTime(): number {
      return 0;
    },
    getDuration(): number {
      return 0;
    },
    isLoaded(): boolean {
      return false;
    },
    on<K extends PlayerAdapterEventType>(_event: K, _callback: PlayerAdapterEventCallback<K>): void {
      // No-op
    },
    off<K extends PlayerAdapterEventType>(_event: K, _callback: PlayerAdapterEventCallback<K>): void {
      // No-op
    },
    supportsHLS(): boolean {
      return false;
    },
    supportsDASH(): boolean {
      return false;
    },
    supportsAirPlay(): boolean {
      return false;
    },
    getEngineName(): string {
      return 'Video.js (Not Implemented)';
    },
    getEngineVersion(): string {
      return 'N/A';
    },
  };
}
