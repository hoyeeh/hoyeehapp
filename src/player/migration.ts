// Migration: Re-export new unified players as drop-in replacements
// This allows gradual migration while preserving existing import paths

// The DesktopPlayer from @/player is the new unified implementation
// It can replace the legacy VideoPlayer component

export { DesktopPlayer as UnifiedDesktopPlayer } from '@/player';
export { MobilePlayer as UnifiedMobilePlayer } from '@/player';
export { KidsPlayer as UnifiedKidsPlayer } from '@/player';

// Note: To migrate, update imports from:
// import { VideoPlayer } from "@/components/VideoPlayer"
// to:
// import { UnifiedDesktopPlayer as VideoPlayer } from "@/player/migration"
//
// The new players use the shared PlayerEngine with:
// - Idempotent load (no reload if same URL)
// - Seek rate limiting (800ms)
// - Same-URL cooldown (4s)
// - Proper event handling
