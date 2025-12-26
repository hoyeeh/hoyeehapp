import { PlayerError, PlayerErrorCode, mapMediaError, createPlayerError } from '../utils/errors';

export interface SourceLoadResult {
  success: boolean;
  error?: PlayerError;
  warnings?: string[];
}

export interface SourceHandler {
  canPlay(url: string): boolean;
  load(videoEl: HTMLVideoElement, url: string, startTime?: number): Promise<SourceLoadResult>;
  destroy(): void;
}

/**
 * MP4/Native video source handler
 * Handles direct video sources that the browser can play natively
 */
export function createMp4Source(): SourceHandler {
  let currentVideoEl: HTMLVideoElement | null = null;
  let loadAbortController: AbortController | null = null;

  return {
    canPlay(url: string): boolean {
      if (!url) return false;
      const lower = url.toLowerCase();
      // Can play non-HLS video formats
      return !lower.includes('.m3u8') && (
        lower.includes('.mp4') ||
        lower.includes('.webm') ||
        lower.includes('.ogg') ||
        lower.includes('.mov') ||
        // Also handle URLs without extension (CDN URLs, etc.)
        !lower.match(/\.(m3u8|mpd)(\?|$)/)
      );
    },

    async load(
      videoEl: HTMLVideoElement,
      url: string,
      startTime?: number
    ): Promise<SourceLoadResult> {
      // Abort any previous load
      if (loadAbortController) {
        loadAbortController.abort();
      }
      loadAbortController = new AbortController();

      currentVideoEl = videoEl;
      const warnings: string[] = [];

      return new Promise((resolve) => {
        // Optional preflight check
        const performPreflight = async () => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(url, {
              method: 'HEAD',
              mode: 'cors',
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok && response.status !== 206) {
              warnings.push(`Server returned status ${response.status}`);
            }

            const acceptRanges = response.headers.get('accept-ranges');
            if (acceptRanges !== 'bytes' && response.status !== 206) {
              warnings.push('Seeking may not work (no Range support)');
            }
          } catch (error) {
            // Preflight errors are non-fatal warnings
            if (error instanceof Error) {
              if (error.name === 'AbortError') {
                warnings.push('Preflight check timed out');
              } else {
                warnings.push(`Preflight check failed: ${error.message}`);
              }
            }
          }
        };

        const loadVideo = async () => {
          // Perform preflight in background (don't block)
          performPreflight();

          const handleCanPlay = () => {
            cleanup();
            
            if (startTime && startTime > 0 && videoEl.duration > 0) {
              if (startTime < videoEl.duration * 0.95) {
                videoEl.currentTime = startTime;
              }
            }

            resolve({ success: true, warnings: warnings.length > 0 ? warnings : undefined });
          };

          const handleError = () => {
            cleanup();
            const error = mapMediaError(videoEl.error);
            resolve({ success: false, error });
          };

          const handleAbort = () => {
            cleanup();
            resolve({
              success: false,
              error: createPlayerError(PlayerErrorCode.MEDIA_ABORTED, 'Video load was aborted'),
            });
          };

          const cleanup = () => {
            videoEl.removeEventListener('canplay', handleCanPlay);
            videoEl.removeEventListener('error', handleError);
            videoEl.removeEventListener('abort', handleAbort);
          };

          videoEl.addEventListener('canplay', handleCanPlay, { once: true });
          videoEl.addEventListener('error', handleError, { once: true });
          videoEl.addEventListener('abort', handleAbort, { once: true });

          // Set source and load
          videoEl.src = url;
          videoEl.load();
        };

        loadVideo();
      });
    },

    destroy(): void {
      if (loadAbortController) {
        loadAbortController.abort();
        loadAbortController = null;
      }
      if (currentVideoEl) {
        currentVideoEl.src = '';
        currentVideoEl.load();
        currentVideoEl = null;
      }
    },
  };
}
