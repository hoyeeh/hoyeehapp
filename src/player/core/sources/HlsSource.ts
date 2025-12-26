import { PlayerError, PlayerErrorCode, createPlayerError, mapMediaError } from '../utils/errors';
import { SourceHandler, SourceLoadResult } from './Mp4Source';

// HLS.js types - dynamically loaded from CDN
interface HlsInstance {
  on: (event: string, callback: (...args: any[]) => void) => void;
  loadSource: (url: string) => void;
  attachMedia: (media: HTMLMediaElement) => void;
  destroy: () => void;
  recoverMediaError: () => void;
}

interface HlsStatic {
  isSupported: () => boolean;
  Events: {
    MEDIA_ATTACHED: string;
    MANIFEST_PARSED: string;
    ERROR: string;
  };
  ErrorTypes: {
    NETWORK_ERROR: string;
    MEDIA_ERROR: string;
  };
  new (config?: Record<string, unknown>): HlsInstance;
}

declare global {
  interface Window {
    Hls?: HlsStatic;
  }
}

/**
 * HLS source handler
 * Uses HLS.js when available, falls back to native HLS (Safari)
 */
export function createHlsSource(): SourceHandler {
  let hls: HlsInstance | null = null;
  let currentVideoEl: HTMLVideoElement | null = null;

  const isHlsSupported = (): boolean => {
    if (typeof window.Hls !== 'undefined') {
      return window.Hls.isSupported();
    }
    return false;
  };

  const isNativeHlsSupported = (videoEl: HTMLVideoElement): boolean => {
    return videoEl.canPlayType('application/vnd.apple.mpegurl') !== '';
  };

  return {
    canPlay(url: string): boolean {
      if (!url) return false;
      const lower = url.toLowerCase();
      return lower.includes('.m3u8') || lower.includes('application/vnd.apple.mpegurl');
    },

    async load(
      videoEl: HTMLVideoElement,
      url: string,
      startTime?: number
    ): Promise<SourceLoadResult> {
      // Clean up any existing HLS instance
      if (hls) {
        hls.destroy();
        hls = null;
      }

      currentVideoEl = videoEl;

      return new Promise((resolve) => {
        // Try HLS.js first if available
        if (isHlsSupported() && window.Hls) {
          const Hls = window.Hls;
          hls = new Hls({
            startPosition: startTime || -1,
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
          });

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls!.loadSource(url);
          });

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (startTime && startTime > 0) {
              videoEl.currentTime = startTime;
            }
            resolve({ success: true });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              let error: PlayerError;

              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  error = createPlayerError(
                    PlayerErrorCode.MEDIA_NETWORK,
                    `Network error: ${data.details}`
                  );
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  error = createPlayerError(
                    PlayerErrorCode.MEDIA_DECODE,
                    `Media error: ${data.details}`
                  );
                  // Try to recover from media errors
                  hls?.recoverMediaError();
                  return;
                default:
                  error = createPlayerError(
                    PlayerErrorCode.UNKNOWN,
                    `HLS error: ${data.details}`
                  );
              }

              hls?.destroy();
              hls = null;
              resolve({ success: false, error });
            }
          });

          hls.attachMedia(videoEl);
        } else if (isNativeHlsSupported(videoEl)) {
          // Use native HLS (Safari, iOS)
          const handleCanPlay = () => {
            cleanup();
            if (startTime && startTime > 0 && videoEl.duration > 0) {
              if (startTime < videoEl.duration * 0.95) {
                videoEl.currentTime = startTime;
              }
            }
            resolve({ success: true });
          };

          const handleError = () => {
            cleanup();
            const error = mapMediaError(videoEl.error);
            resolve({ success: false, error });
          };

          const cleanup = () => {
            videoEl.removeEventListener('canplay', handleCanPlay);
            videoEl.removeEventListener('error', handleError);
          };

          videoEl.addEventListener('canplay', handleCanPlay, { once: true });
          videoEl.addEventListener('error', handleError, { once: true });

          videoEl.src = url;
          videoEl.load();
        } else {
          // HLS not supported
          resolve({
            success: false,
            error: createPlayerError(
              PlayerErrorCode.MEDIA_FORMAT,
              'HLS playback is not supported in this browser'
            ),
          });
        }
      });
    },

    destroy(): void {
      if (hls) {
        hls.destroy();
        hls = null;
      }
      if (currentVideoEl) {
        currentVideoEl.src = '';
        currentVideoEl.load();
        currentVideoEl = null;
      }
    },
  };
}

/**
 * Load HLS.js dynamically if not already loaded
 */
export async function loadHlsJs(): Promise<boolean> {
  if (typeof window.Hls !== 'undefined') {
    return true;
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.4.12/dist/hls.min.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}
