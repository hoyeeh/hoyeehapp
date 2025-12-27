// Playback Adapters
export * from './PlayerAdapter';
export { createShakaAdapter } from './ShakaAdapter';
export { createVideoJsAdapter } from './VideoJsAdapter';

import { createShakaAdapter } from './ShakaAdapter';
import { PlayerAdapter, PlayerAdapterFactory } from './PlayerAdapter';

/**
 * Default adapter factory - uses Shaka Player
 */
export const createDefaultAdapter: PlayerAdapterFactory = (options) => {
  return createShakaAdapter(options);
};

/**
 * Get the recommended adapter for the current platform
 */
export function getRecommendedAdapter(): PlayerAdapterFactory {
  // Currently always use Shaka, but this could be extended
  // to select different adapters based on platform/browser
  return createShakaAdapter;
}
