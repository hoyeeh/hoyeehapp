import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface CastState {
  isAvailable: boolean;
  isConnected: boolean;
  deviceName: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  volume: number;
  isInitialized: boolean;
  devices: CastDevice[];
}

interface CastDevice {
  id: string;
  name: string;
  model: string;
}

interface UseCastOptions {
  mediaUrl?: string;
  mediaTitle?: string;
  mediaThumbnail?: string;
  mediaType?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onConnectionChange?: (connected: boolean) => void;
}

// Cast Application Framework types
declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: {
      framework?: {
        CastContext: {
          getInstance: () => CastContext;
        };
        RemotePlayerController: new (player: RemotePlayer) => RemotePlayerController;
        RemotePlayer: new () => RemotePlayer;
        CastContextEventType: {
          CAST_STATE_CHANGED: string;
          SESSION_STATE_CHANGED: string;
        };
        RemotePlayerEventType: {
          ANY_CHANGE: string;
          IS_CONNECTED_CHANGED: string;
          IS_MEDIA_LOADED_CHANGED: string;
          DURATION_CHANGED: string;
          CURRENT_TIME_CHANGED: string;
          IS_PAUSED_CHANGED: string;
          VOLUME_LEVEL_CHANGED: string;
          IS_MUTED_CHANGED: string;
          PLAYER_STATE_CHANGED: string;
        };
        CastState: {
          NO_DEVICES_AVAILABLE: string;
          NOT_CONNECTED: string;
          CONNECTING: string;
          CONNECTED: string;
        };
        SessionState: {
          NO_SESSION: string;
          SESSION_STARTING: string;
          SESSION_STARTED: string;
          SESSION_START_FAILED: string;
          SESSION_ENDING: string;
          SESSION_ENDED: string;
          SESSION_RESUMED: string;
        };
      };
    };
    chrome?: {
      cast?: {
        isAvailable: boolean;
        media: {
          MediaInfo: new (contentId: string, contentType: string) => ChromeMediaInfo;
          GenericMediaMetadata: new () => GenericMediaMetadata;
          LoadRequest: new (mediaInfo: ChromeMediaInfo) => ChromeLoadRequest;
        };
        Image: new (url: string) => ChromeImage;
        AutoJoinPolicy: {
          ORIGIN_SCOPED: string;
          TAB_AND_ORIGIN_SCOPED: string;
          PAGE_SCOPED: string;
        };
        DefaultActionPolicy: {
          CREATE_SESSION: string;
          CAST_THIS_TAB: string;
        };
      };
    };
  }
}

interface CastContext {
  setOptions: (options: CastOptions) => void;
  getCastState: () => string;
  getSessionState: () => string;
  getCurrentSession: () => CastSession | null;
  requestSession: () => Promise<void>;
  endCurrentSession: (stopCasting: boolean) => void;
  addEventListener: (type: string, handler: (event: CastEvent) => void) => void;
  removeEventListener: (type: string, handler: (event: CastEvent) => void) => void;
}

interface CastOptions {
  receiverApplicationId: string;
  autoJoinPolicy: string;
  resumeSavedSession?: boolean;
}

interface CastSession {
  getSessionId: () => string;
  getCastDevice: () => { friendlyName: string; model: string };
  loadMedia: (request: ChromeLoadRequest) => Promise<void>;
  endSession: (stopCasting: boolean) => void;
  getMediaSession: () => MediaSession | null;
}

interface MediaSession {
  getEstimatedTime: () => number;
  media: {
    duration: number;
  };
}

interface CastEvent {
  castState?: string;
  sessionState?: string;
}

interface RemotePlayer {
  isConnected: boolean;
  isMediaLoaded: boolean;
  duration: number;
  currentTime: number;
  isPaused: boolean;
  isMuted: boolean;
  volumeLevel: number;
  playerState: string;
  displayName: string;
}

interface RemotePlayerController {
  addEventListener: (type: string, handler: (event: RemotePlayerEvent) => void) => void;
  removeEventListener: (type: string, handler: (event: RemotePlayerEvent) => void) => void;
  playOrPause: () => void;
  stop: () => void;
  seek: () => void;
  setVolumeLevel: () => void;
  muteOrUnmute: () => void;
}

interface RemotePlayerEvent {
  field: string;
  value: unknown;
}

interface ChromeMediaInfo {
  contentId: string;
  contentType: string;
  metadata: GenericMediaMetadata;
  streamType: string;
}

interface GenericMediaMetadata {
  metadataType: number;
  title: string;
  images: ChromeImage[];
}

interface ChromeImage {
  url: string;
}

interface ChromeLoadRequest {
  autoplay: boolean;
  currentTime: number;
}

const CAST_RECEIVER_APP_ID = 'CC1AD845'; // Default Media Receiver

export function useGoogleCast(options: UseCastOptions = {}) {
  const { 
    mediaUrl, 
    mediaTitle, 
    mediaThumbnail, 
    mediaType = 'video/mp4', 
    onTimeUpdate,
    onConnectionChange 
  } = options;
  
  const [state, setState] = useState<CastState>({
    isAvailable: false,
    isConnected: false,
    deviceName: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isMuted: false,
    volume: 1,
    isInitialized: false,
    devices: [],
  });

  const castContextRef = useRef<CastContext | null>(null);
  const playerRef = useRef<RemotePlayer | null>(null);
  const controllerRef = useRef<RemotePlayerController | null>(null);
  const timeUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializationAttemptedRef = useRef(false);

  // Load Cast SDK script
  const loadCastSDK = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      // Check if already loaded
      if (window.cast?.framework) {
        console.log('[GoogleCast] SDK already loaded');
        resolve(true);
        return;
      }

      // Check if script already exists
      const existingScript = document.querySelector('script[src*="cast_sender"]');
      if (existingScript) {
        console.log('[GoogleCast] Script already exists, waiting for initialization');
        // Wait for the SDK to be ready
        const checkInterval = setInterval(() => {
          if (window.cast?.framework) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 10000);
        return;
      }

      // Set up callback before loading script
      window.__onGCastApiAvailable = (isAvailable: boolean) => {
        console.log('[GoogleCast] API available:', isAvailable);
        resolve(isAvailable);
      };

      // Load the Cast Application Framework
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      script.onerror = () => {
        console.error('[GoogleCast] Failed to load Cast SDK');
        resolve(false);
      };
      document.head.appendChild(script);

      // Timeout fallback
      setTimeout(() => {
        if (!window.cast?.framework) {
          console.warn('[GoogleCast] SDK load timeout');
          resolve(false);
        }
      }, 10000);
    });
  }, []);

  // Initialize Cast Application Framework
  const initializeCastFramework = useCallback(() => {
    if (!window.cast?.framework) {
      console.error('[GoogleCast] Cast framework not available');
      return false;
    }

    try {
      const castContext = window.cast.framework.CastContext.getInstance();
      
      // Configure Cast options
      castContext.setOptions({
        receiverApplicationId: CAST_RECEIVER_APP_ID,
        autoJoinPolicy: window.chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED || 'origin_scoped',
        resumeSavedSession: true,
      });

      castContextRef.current = castContext;

      // Initialize Remote Player and Controller
      const player = new window.cast.framework.RemotePlayer();
      const controller = new window.cast.framework.RemotePlayerController(player);

      playerRef.current = player;
      controllerRef.current = controller;

      // Listen for cast state changes
      const handleCastStateChanged = (event: CastEvent) => {
        console.log('[GoogleCast] Cast state changed:', event.castState);
        
        const isAvailable = event.castState !== window.cast?.framework?.CastState.NO_DEVICES_AVAILABLE;
        setState(prev => ({ ...prev, isAvailable }));
      };

      // Listen for session state changes
      const handleSessionStateChanged = (event: CastEvent) => {
        console.log('[GoogleCast] Session state changed:', event.sessionState);
        
        const sessionState = event.sessionState;
        const framework = window.cast?.framework;
        
        if (sessionState === framework?.SessionState.SESSION_STARTED ||
            sessionState === framework?.SessionState.SESSION_RESUMED) {
          const session = castContext.getCurrentSession();
          if (session) {
            const device = session.getCastDevice();
            setState(prev => ({
              ...prev,
              isConnected: true,
              deviceName: device.friendlyName,
            }));
            onConnectionChange?.(true);
            toast.success(`Connected to ${device.friendlyName}`);
          }
        } else if (sessionState === framework?.SessionState.SESSION_ENDED) {
          handleDisconnect();
        }
      };

      // Listen for player changes
      const handlePlayerChange = (event: RemotePlayerEvent) => {
        const player = playerRef.current;
        if (!player) return;

        switch (event.field) {
          case 'isConnected':
            setState(prev => ({ ...prev, isConnected: player.isConnected }));
            if (player.isConnected) {
              setState(prev => ({ ...prev, deviceName: player.displayName }));
            }
            break;
          case 'isPaused':
            setState(prev => ({ ...prev, isPlaying: !player.isPaused }));
            break;
          case 'currentTime':
            setState(prev => ({ ...prev, currentTime: player.currentTime }));
            onTimeUpdate?.(player.currentTime);
            break;
          case 'duration':
            setState(prev => ({ ...prev, duration: player.duration }));
            break;
          case 'volumeLevel':
            setState(prev => ({ ...prev, volume: player.volumeLevel }));
            break;
          case 'isMuted':
            setState(prev => ({ ...prev, isMuted: player.isMuted }));
            break;
        }
      };

      // Add event listeners
      castContext.addEventListener(
        window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        handleCastStateChanged
      );
      
      castContext.addEventListener(
        window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        handleSessionStateChanged
      );

      controller.addEventListener(
        window.cast.framework.RemotePlayerEventType.ANY_CHANGE,
        handlePlayerChange
      );

      // Check initial state
      const initialCastState = castContext.getCastState();
      const isAvailable = initialCastState !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE;
      
      // Check for existing session
      const currentSession = castContext.getCurrentSession();
      if (currentSession) {
        const device = currentSession.getCastDevice();
        setState(prev => ({
          ...prev,
          isAvailable,
          isConnected: true,
          deviceName: device.friendlyName,
          isInitialized: true,
        }));
      } else {
        setState(prev => ({ ...prev, isAvailable, isInitialized: true }));
      }

      console.log('[GoogleCast] Framework initialized successfully');
      return true;
    } catch (error) {
      console.error('[GoogleCast] Framework initialization error:', error);
      return false;
    }
  }, [onTimeUpdate, onConnectionChange]);

  const handleDisconnect = useCallback(() => {
    castContextRef.current = null;
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isConnected: false,
      deviceName: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }));
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  // Initialize Cast SDK on mount
  useEffect(() => {
    if (initializationAttemptedRef.current) return;
    initializationAttemptedRef.current = true;

    const init = async () => {
      console.log('[GoogleCast] Starting initialization...');
      const sdkLoaded = await loadCastSDK();
      
      if (sdkLoaded) {
        // Small delay to ensure framework is fully ready
        setTimeout(() => {
          initializeCastFramework();
        }, 500);
      } else {
        console.warn('[GoogleCast] SDK not available');
        setState(prev => ({ ...prev, isInitialized: true }));
      }
    };

    init();

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [loadCastSDK, initializeCastFramework]);

  // Connect to a Cast device
  const connect = useCallback(async () => {
    const castContext = castContextRef.current;
    
    if (!castContext) {
      toast.error('Cast not initialized');
      return;
    }

    try {
      await castContext.requestSession();
    } catch (error: unknown) {
      const castError = error as { code?: string };
      if (castError.code !== 'cancel') {
        console.error('[GoogleCast] Connection error:', error);
        toast.error('Failed to connect to Cast device');
      }
    }
  }, []);

  // Disconnect from Cast device
  const disconnect = useCallback(() => {
    const castContext = castContextRef.current;
    
    if (castContext) {
      const session = castContext.getCurrentSession();
      if (session) {
        session.endSession(true);
      }
      castContext.endCurrentSession(true);
    }
    
    handleDisconnect();
    toast.info('Disconnected from Cast device');
  }, [handleDisconnect]);

  // Load media onto the Cast device
  const loadMedia = useCallback(async (
    url?: string,
    title?: string,
    thumbnail?: string,
    startTime: number = 0
  ) => {
    const castContext = castContextRef.current;
    
    if (!castContext) {
      toast.error('Cast not initialized');
      return;
    }

    const session = castContext.getCurrentSession();
    if (!session) {
      toast.error('No active Cast session');
      return;
    }

    const mediaUrlToLoad = url || mediaUrl;
    if (!mediaUrlToLoad) {
      toast.error('No media URL provided');
      return;
    }

    try {
      const mediaInfo = new window.chrome!.cast!.media.MediaInfo(mediaUrlToLoad, mediaType);
      mediaInfo.metadata = new window.chrome!.cast!.media.GenericMediaMetadata();
      mediaInfo.metadata.metadataType = 0;
      mediaInfo.metadata.title = title || mediaTitle || 'Video';
      
      const thumbnailUrl = thumbnail || mediaThumbnail;
      if (thumbnailUrl) {
        mediaInfo.metadata.images = [new window.chrome!.cast!.Image(thumbnailUrl)];
      }

      const request = new window.chrome!.cast!.media.LoadRequest(mediaInfo);
      request.autoplay = true;
      request.currentTime = startTime;

      await session.loadMedia(request);
      
      const device = session.getCastDevice();
      toast.success(`Now playing on ${device.friendlyName}`);
      
      setState(prev => ({ ...prev, isPlaying: true }));
    } catch (error) {
      console.error('[GoogleCast] Load media error:', error);
      toast.error('Failed to load media on Cast device');
    }
  }, [mediaUrl, mediaTitle, mediaThumbnail, mediaType]);

  // Play/Pause toggle
  const play = useCallback(() => {
    const controller = controllerRef.current;
    const player = playerRef.current;
    
    if (controller && player?.isPaused) {
      controller.playOrPause();
    }
  }, []);

  const pause = useCallback(() => {
    const controller = controllerRef.current;
    const player = playerRef.current;
    
    if (controller && player && !player.isPaused) {
      controller.playOrPause();
    }
  }, []);

  // Seek to a specific time
  const seek = useCallback((time: number) => {
    const controller = controllerRef.current;
    const player = playerRef.current;
    
    if (controller && player) {
      player.currentTime = time;
      controller.seek();
      setState(prev => ({ ...prev, currentTime: time }));
    }
  }, []);

  // Set volume (0-1)
  const setVolume = useCallback((level: number) => {
    const controller = controllerRef.current;
    const player = playerRef.current;
    
    if (controller && player) {
      player.volumeLevel = Math.max(0, Math.min(1, level));
      controller.setVolumeLevel();
      setState(prev => ({ ...prev, volume: level }));
    }
  }, []);

  // Toggle mute
  const setMuted = useCallback((muted: boolean) => {
    const controller = controllerRef.current;
    const player = playerRef.current;
    
    if (controller && player && player.isMuted !== muted) {
      controller.muteOrUnmute();
    }
  }, []);

  // Stop playback
  const stop = useCallback(() => {
    const controller = controllerRef.current;
    
    if (controller) {
      controller.stop();
      setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    }
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    loadMedia,
    play,
    pause,
    seek,
    setVolume,
    setMuted,
    stop,
  };
}
