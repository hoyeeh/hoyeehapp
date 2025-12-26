// Hoyeeh Player Core - Unified Video Player System
// Re-exports for easy imports

// Core Engine
export { createPlayer } from './core/PlayerEngine';
export type { 
  PlayerInstance, 
  PlayerOptions, 
  PlayerPlatform,
  PlayerEventMap,
  PlayerEventCallback,
  PlayerState,
  PlayerMetadata,
} from './core/PlayerEngine';

// State
export { createPlayerStore, initialPlayerState } from './core/state/playerStore';
export type { PlayerStore } from './core/state/playerStore';

// Sources
export { createMp4Source } from './core/sources/Mp4Source';
export { createHlsSource, loadHlsJs } from './core/sources/HlsSource';
export type { SourceHandler, SourceLoadResult } from './core/sources/Mp4Source';

// Utilities
export { 
  formatTime, 
  parseTime, 
  calculateDrift, 
  shouldSeek, 
  calculateProgress,
  calculateBufferedProgress,
  isNearEnd,
  clamp,
} from './core/utils/time';

export {
  throttle,
  debounce,
  createRateLimiter,
} from './core/utils/throttle';

export {
  PlayerErrorCode,
  mapMediaError,
  createPlayerError,
} from './core/utils/errors';

export type {
  PlayerError,
  PlayerErrorCodeType,
} from './core/utils/errors';

// Cast Adapters
export * from './adapters/cast';

// Analytics Adapter
export { createAnalyticsAdapter } from './adapters/analytics/AnalyticsAdapter';
export type { AnalyticsAdapterInstance, AnalyticsOptions } from './adapters/analytics/AnalyticsAdapter';
