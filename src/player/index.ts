// Hoyeeh Player - Unified Video Player System
// 
// This module provides a unified video player system across all platforms:
// - Desktop (DesktopPlayer)
// - Mobile/PWA (MobilePlayer)  
// - Kids App (KidsPlayer)
// - TV Receiver (uses core PlayerEngine logic)
//
// Key Features:
// - Shared PlayerEngine with idempotent load/seek
// - Cast integration via CastController/CastReceiver adapters
// - Analytics tracking via AnalyticsAdapter
// - Platform-specific UI skins
//
// Usage:
// import { DesktopPlayer, MobilePlayer, KidsPlayer } from '@/player';
// import { createPlayer, formatTime } from '@/player';

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

// Playback Adapters (Shaka, Video.js placeholder)
export * from './adapters/playback';

// Analytics Adapter
export { createAnalyticsAdapter } from './adapters/analytics/AnalyticsAdapter';
export type { AnalyticsAdapterInstance, AnalyticsOptions } from './adapters/analytics/AnalyticsAdapter';

// UI Components (Platform-specific skins using shared PlayerEngine)
export { DesktopPlayer } from './ui/desktop/DesktopPlayer';
export { MobilePlayer } from './ui/mobile/MobilePlayer';
export { KidsPlayer } from './ui/kids/KidsPlayer';

// Migration helpers
export * from './migration';
