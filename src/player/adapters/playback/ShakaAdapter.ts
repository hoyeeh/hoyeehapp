/**
 * ShakaAdapter - Shaka Player implementation of PlayerAdapter
 * 
 * Uses Shaka Player for robust streaming support (HLS, DASH)
 * Falls back to native playback on Safari for optimal HLS performance
 */

import shaka from 'shaka-player';
import {
  PlayerAdapter,
  PlayerAdapterOptions,
  PlayerMetadata,
  PlaybackState,
  PlayerAdapterError,
  PlayerAdapterEventType,
  PlayerAdapterEventCallback,
  PlayerAdapterEvents,
} from './PlayerAdapter';

const DEBUG_KEY = 'HOYEEH_DEBUG';

function debugLog(message: string, ...args: unknown[]): void {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(DEBUG_KEY) === '1') {
    console.log(`[ShakaAdapter] ${message}`, ...args);
  }
}

export function createShakaAdapter(options?: Partial<PlayerAdapterOptions>): PlayerAdapter {
  let videoElement: HTMLVideoElement | null = null;
  let player: shaka.Player | null = null;
  let isInitialized = false;
  let currentUrl: string | null = null;
  let currentMetadata: PlayerMetadata | null = null;
  let useNative = false;

  // Event listeners map
  const eventListeners = new Map<PlayerAdapterEventType, Set<Function>>();

  // Track DOM event listeners so we can reliably detach them (prevents leaks/duplication)
  let domListeners: Array<[string, EventListener]> = [];

  // Internal state
  let state: PlaybackState = {
    isPlaying: false,
    isPaused: true,
    isBuffering: false,
    isEnded: false,
    isSeeking: false,
    currentTime: 0,
    duration: 0,
    bufferedTime: 0,
    volume: 1,
    muted: true, // Start muted for autoplay
    playbackRate: 1,
    error: null,
  };

  const emit = <K extends PlayerAdapterEventType>(
    event: K,
    data?: PlayerAdapterEvents[K]
  ): void => {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          (callback as any)(data);
        } catch (e) {
          console.error(`[ShakaAdapter] Error in ${event} listener:`, e);
        }
      });
    }
  };

  const updateState = (updates: Partial<PlaybackState>): void => {
    state = { ...state, ...updates };
    emit('statechange', state);
  };

  const attachVideoListeners = (): void => {
    if (!videoElement) return;

    // Detach any previously attached listeners (in case init/load cycles happen)
    domListeners.forEach(([event, handler]) => {
      videoElement?.removeEventListener(event, handler);
    });
    domListeners = [];

    const handlers: Record<string, EventListener> = {
      play: () => {
        updateState({ isPlaying: true, isPaused: false });
        emit('play');
      },
      pause: () => {
        updateState({ isPlaying: false, isPaused: true });
        emit('pause');
      },
      playing: () => {
        updateState({ isPlaying: true, isPaused: false, isBuffering: false });
        emit('playing');
      },
      waiting: () => {
        updateState({ isBuffering: true });
        emit('waiting');
      },
      ended: () => {
        updateState({ isPlaying: false, isEnded: true });
        emit('ended');
      },
      timeupdate: () => {
        const currentTime = videoElement?.currentTime || 0;
        const duration = videoElement?.duration || 0;
        updateState({ currentTime, duration });
        emit('timeupdate', { currentTime, duration });
      },
      durationchange: () => {
        const duration = videoElement?.duration || 0;
        updateState({ duration });
        emit('durationchange', { duration });
      },
      volumechange: () => {
        const volume = videoElement?.volume || 0;
        const muted = videoElement?.muted || false;
        updateState({ volume, muted });
        emit('volumechange', { volume, muted });
      },
      loadedmetadata: () => {
        const duration = videoElement?.duration || 0;
        updateState({ duration });
        emit('loadedmetadata', { duration });
      },
      canplay: () => {
        updateState({ isBuffering: false });
        emit('canplay');
      },
      seeking: () => {
        updateState({ isSeeking: true });
        emit('seeking');
      },
      seeked: () => {
        updateState({ isSeeking: false });
        emit('seeked');
      },
      error: () => {
        const error = videoElement?.error;
        if (error) {
          const adapterError: PlayerAdapterError = {
            code: `MEDIA_${error.code}`,
            message: error.message || 'Media playback error',
            severity: 'error',
            recoverable: false,
          };
          updateState({ error: adapterError, isBuffering: false });
          emit('error', adapterError);
        }
      },
      progress: () => {
        if (videoElement && videoElement.buffered.length > 0) {
          const bufferedTime = videoElement.buffered.end(videoElement.buffered.length - 1);
          updateState({ bufferedTime });
        }
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      videoElement?.addEventListener(event, handler);
      domListeners.push([event, handler]);
    });
  };

  const getUrlPathname = (url: string): string => {
    try {
      return new URL(url, window.location.href).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  };

  const isHlsUrl = (url: string): boolean => {
    const lower = url.toLowerCase();
    return lower.includes('.m3u8') || lower.includes('application/vnd.apple.mpegurl');
  };

  const isDashUrl = (url: string): boolean => {
    const lower = url.toLowerCase();
    return lower.includes('.mpd') || lower.includes('application/dash+xml');
  };

  const isProgressiveUrl = (url: string): boolean => {
    const lower = url.toLowerCase();
    if (lower.startsWith('blob:') || lower.startsWith('data:')) return true;

    const pathname = getUrlPathname(url);
    return ['.mp4', '.m4v', '.mov', '.webm', '.ogg', '.ogv'].some((ext) => pathname.endsWith(ext));
  };

  const shouldUseNative = (url: string): boolean => {
    // 1) Always use native for progressive sources (mp4/webm/blob downloads)
    if (isProgressiveUrl(url)) return true;

    // 2) Use native HLS on Safari/iOS for better performance
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    return (isSafari || isIOS) && isHlsUrl(url);
  };

  const adapter: PlayerAdapter = {
    async init(videoEl: HTMLVideoElement, opts?: Partial<PlayerAdapterOptions>): Promise<void> {
      if (isInitialized) {
        debugLog('Already initialized, skipping');
        return;
      }

      videoElement = videoEl;
      
      // Install Shaka polyfills
      shaka.polyfill.installAll();
      
      if (!shaka.Player.isBrowserSupported()) {
        console.warn('[ShakaAdapter] Shaka Player not supported, using native playback');
        useNative = true;
      }

      if (!useNative) {
        player = new shaka.Player();
        await player.attach(videoElement);
        
        // Configure Shaka
        player.configure({
          streaming: {
            bufferingGoal: 30,
            rebufferingGoal: 2,
            bufferBehind: 30,
            retryParameters: {
              maxAttempts: 4,
              baseDelay: 1000,
              backoffFactor: 2,
            },
          },
          abr: {
            enabled: true,
            defaultBandwidthEstimate: 1000000,
          },
        });

        // Shaka error handling
        player.addEventListener('error', (event) => {
          const error = (event as any).detail;
          debugLog('Shaka error:', error);
          
          const adapterError: PlayerAdapterError = {
            code: `SHAKA_${error.code}`,
            message: error.message || 'Shaka playback error',
            severity: error.severity === shaka.util.Error.Severity.CRITICAL ? 'fatal' : 'error',
            recoverable: error.severity !== shaka.util.Error.Severity.CRITICAL,
          };
          
          updateState({ error: adapterError, isBuffering: false });
          emit('error', adapterError);
        });

        // Buffering events
        player.addEventListener('buffering', (event) => {
          const buffering = (event as any).buffering;
          updateState({ isBuffering: buffering });
          if (buffering) emit('waiting');
        });
      }

      attachVideoListeners();
      isInitialized = true;
      debugLog('Initialized successfully', { useNative });
    },

    destroy(): void {
      const video = videoElement;

      // Detach DOM listeners to avoid leaks and cross-instance callbacks
      if (video) {
        domListeners.forEach(([event, handler]) => {
          video.removeEventListener(event, handler);
        });
        domListeners = [];
      }

      if (player) {
        player.destroy();
        player = null;
      }

      if (video) {
        video.pause();
        video.src = '';
        video.load();
      }

      eventListeners.clear();
      videoElement = null;
      currentUrl = null;
      currentMetadata = null;
      isInitialized = false;

      state = {
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

      debugLog('Destroyed');
    },

    async load(url: string, startTime?: number, metadata?: PlayerMetadata): Promise<boolean> {
      if (!videoElement || !isInitialized) {
        debugLog('Cannot load: not initialized');
        return false;
      }

      if (!url) {
        debugLog('Cannot load: empty URL');
        return false;
      }

      const video = videoElement; // snapshot for async safety

      emit('loadstart', { url });
      updateState({ isBuffering: true, error: null, isEnded: false });
      currentUrl = url;
      currentMetadata = metadata || null;

      const applyStartTime = (t?: number) => {
        if (!t || t <= 0) return;

        const seekTo = () => {
          try {
            video.currentTime = t;
          } catch {
            // ignore
          }
        };

        if (video.readyState >= 1) {
          seekTo();
        } else {
          video.addEventListener('loadedmetadata', seekTo, { once: true });
        }
      };

      const attemptAutoplay = async () => {
        try {
          await video.play();
        } catch (e) {
          debugLog('Autoplay blocked:', e);
        }
      };

      try {
        const streaming = isHlsUrl(url) || isDashUrl(url);
        const forceNative = shouldUseNative(url);
        const shouldPlayNative = useNative || forceNative || !streaming;

        if (shouldPlayNative) {
          debugLog('Using native playback for:', url, { streaming, forceNative });

          // If Shaka was previously active, unload it before switching to native src
          if (player) {
            try {
              await player.unload();
            } catch {
              // ignore
            }
          }

          video.src = url;
          video.load();
          applyStartTime(startTime);
        } else if (player) {
          debugLog('Using Shaka Player for:', url);
          await player.load(url, startTime || 0);
        } else {
          debugLog('No Shaka player instance, falling back to native playback for:', url);
          video.src = url;
          video.load();
          applyStartTime(startTime);
        }

        await attemptAutoplay();
        return true;
      } catch (error: any) {
        debugLog('Load error:', error);

        // One-shot fallback: if Shaka load failed, retry with native playback
        try {
          const streaming = isHlsUrl(url) || isDashUrl(url);
          const forceNative = shouldUseNative(url);
          const attemptedShaka = !useNative && !forceNative && streaming && !!player;

          if (attemptedShaka) {
            debugLog('Retrying with native playback after Shaka failure:', url);
            if (player) {
              try {
                await player.unload();
              } catch {
                // ignore
              }
            }

            video.src = url;
            video.load();
            applyStartTime(startTime);
            await attemptAutoplay();
            return true;
          }
        } catch (fallbackErr) {
          debugLog('Native fallback also failed:', fallbackErr);
        }

        const adapterError: PlayerAdapterError = {
          code: error.code?.toString() || 'LOAD_ERROR',
          message: error.message || 'Failed to load video',
          severity: 'error',
          recoverable: true,
        };

        updateState({ error: adapterError, isBuffering: false });
        emit('error', adapterError);

        return false;
      }
    },

    unload(): void {
      if (player) {
        player.unload();
      }
      if (videoElement) {
        videoElement.src = '';
        videoElement.load();
      }
      currentUrl = null;
      currentMetadata = null;
      updateState({
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        isPaused: true,
        isBuffering: false,
        isEnded: false,
      });
    },

    async play(): Promise<void> {
      const video = videoElement;
      if (!video) return;

      try {
        await video.play();
      } catch (e) {
        debugLog('Play failed:', e);

        // Try muted autoplay (guards against autoplay restrictions)
        try {
          if (!video.muted) {
            video.muted = true;
            updateState({ muted: true });
            await video.play();
          }
        } catch (e2) {
          debugLog('Muted play also failed:', e2);
        }
      }
    },

    pause(): void {
      videoElement?.pause();
    },

    seek(time: number): boolean {
      if (!videoElement || !isFinite(time)) return false;
      
      const duration = videoElement.duration || 0;
      if (duration <= 0) return false;
      
      const clampedTime = Math.max(0, Math.min(time, duration));
      videoElement.currentTime = clampedTime;
      return true;
    },

    setVolume(volume: number): void {
      if (!videoElement) return;
      const clampedVolume = Math.max(0, Math.min(1, volume));
      videoElement.volume = clampedVolume;
      if (clampedVolume > 0 && videoElement.muted) {
        videoElement.muted = false;
      }
    },

    setMuted(muted: boolean): void {
      if (videoElement) {
        videoElement.muted = muted;
      }
    },

    getVolume(): number {
      return videoElement?.volume || 0;
    },

    isMuted(): boolean {
      return videoElement?.muted || false;
    },

    setPlaybackRate(rate: number): void {
      if (!videoElement) return;
      const clampedRate = Math.max(0.25, Math.min(4, rate));
      videoElement.playbackRate = clampedRate;
      updateState({ playbackRate: clampedRate });
    },

    getPlaybackRate(): number {
      return videoElement?.playbackRate || 1;
    },

    getState(): PlaybackState {
      return { ...state };
    },

    getCurrentTime(): number {
      return videoElement?.currentTime || 0;
    },

    getDuration(): number {
      return videoElement?.duration || 0;
    },

    isLoaded(): boolean {
      return currentUrl !== null;
    },

    on<K extends PlayerAdapterEventType>(event: K, callback: PlayerAdapterEventCallback<K>): void {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set());
      }
      eventListeners.get(event)!.add(callback);
    },

    off<K extends PlayerAdapterEventType>(event: K, callback: PlayerAdapterEventCallback<K>): void {
      eventListeners.get(event)?.delete(callback);
    },

    supportsHLS(): boolean {
      return true; // Shaka supports HLS
    },

    supportsDASH(): boolean {
      return !useNative; // Shaka supports DASH, native doesn't
    },

    supportsAirPlay(): boolean {
      // Check for AirPlay support
      const video = document.createElement('video');
      return 'webkitShowPlaybackTargetPicker' in video || 
             'remote' in HTMLMediaElement.prototype;
    },

    getEngineName(): string {
      return useNative ? 'Native' : 'Shaka Player';
    },

    getEngineVersion(): string {
      if (useNative) return 'native';
      return shaka.Player.version || 'unknown';
    },
  };

  return adapter;
}
