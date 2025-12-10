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
}

interface UseCastOptions {
  mediaUrl?: string;
  mediaTitle?: string;
  mediaThumbnail?: string;
  mediaType?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

declare global {
  interface Window {
    chrome: {
      cast: {
        isAvailable: boolean;
        SessionRequest: new (appId: string) => object;
        ApiConfig: new (
          sessionRequest: object,
          sessionListener: (session: CastSession) => void,
          receiverListener: (available: string) => void
        ) => object;
        initialize: (
          apiConfig: object,
          onSuccess: () => void,
          onError: (error: CastError) => void
        ) => void;
        requestSession: (
          onSuccess: (session: CastSession) => void,
          onError: (error: CastError) => void
        ) => void;
        ReceiverAvailability: {
          AVAILABLE: string;
          UNAVAILABLE: string;
        };
        media: {
          MediaInfo: new (mediaUrl: string, contentType: string) => MediaInfo;
          LoadRequest: new (mediaInfo: MediaInfo) => LoadRequest;
          GenericMediaMetadata: new () => GenericMediaMetadata;
        };
      };
    };
    __onGCastApiAvailable: (isAvailable: boolean) => void;
  }
}

interface CastSession {
  receiver: {
    friendlyName: string;
  };
  media: CastMedia[];
  loadMedia: (
    loadRequest: LoadRequest,
    onSuccess: () => void,
    onError: (error: CastError) => void
  ) => void;
  stop: (
    onSuccess: () => void,
    onError: (error: CastError) => void
  ) => void;
  setReceiverVolumeLevel: (
    level: number,
    onSuccess: () => void,
    onError: (error: CastError) => void
  ) => void;
  setReceiverMuted: (
    muted: boolean,
    onSuccess: () => void,
    onError: (error: CastError) => void
  ) => void;
  addUpdateListener: (listener: (isAlive: boolean) => void) => void;
}

interface CastMedia {
  play: (request: object | null, onSuccess: () => void, onError: (error: CastError) => void) => void;
  pause: (request: object | null, onSuccess: () => void, onError: (error: CastError) => void) => void;
  seek: (request: SeekRequest, onSuccess: () => void, onError: (error: CastError) => void) => void;
  getEstimatedTime: () => number;
  media: {
    duration: number;
  };
  playerState: string;
  addUpdateListener: (listener: (isAlive: boolean) => void) => void;
}

interface MediaInfo {
  metadata: GenericMediaMetadata;
}

interface GenericMediaMetadata {
  title?: string;
  images?: { url: string }[];
}

interface LoadRequest {
  autoplay: boolean;
  currentTime: number;
}

interface SeekRequest {
  currentTime: number;
}

interface CastError {
  code: string;
  description: string;
}

const CAST_RECEIVER_APP_ID = 'CC1AD845'; // Default Media Receiver

export function useGoogleCast(options: UseCastOptions = {}) {
  const { mediaUrl, mediaTitle, mediaThumbnail, mediaType = 'video/mp4', onTimeUpdate } = options;
  
  const [state, setState] = useState<CastState>({
    isAvailable: false,
    isConnected: false,
    deviceName: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isMuted: false,
    volume: 1,
  });

  const sessionRef = useRef<CastSession | null>(null);
  const mediaRef = useRef<CastMedia | null>(null);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Cast SDK
  useEffect(() => {
    const initializeCast = () => {
      if (!window.chrome?.cast?.isAvailable) {
        // Load Cast SDK
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
        script.async = true;
        document.head.appendChild(script);

        window.__onGCastApiAvailable = (isAvailable: boolean) => {
          if (isAvailable) {
            initializeCastApi();
          }
        };
      } else {
        initializeCastApi();
      }
    };

    const initializeCastApi = () => {
      try {
        const sessionRequest = new window.chrome.cast.SessionRequest(CAST_RECEIVER_APP_ID);
        const apiConfig = new window.chrome.cast.ApiConfig(
          sessionRequest,
          sessionListener,
          receiverListener
        );

        window.chrome.cast.initialize(
          apiConfig,
          () => console.log('Cast SDK initialized'),
          (error) => console.error('Cast SDK init error:', error)
        );
      } catch (e) {
        console.error('Cast initialization error:', e);
      }
    };

    const sessionListener = (session: CastSession) => {
      sessionRef.current = session;
      setState(prev => ({
        ...prev,
        isConnected: true,
        deviceName: session.receiver.friendlyName,
      }));

      session.addUpdateListener((isAlive: boolean) => {
        if (!isAlive) {
          handleDisconnect();
        }
      });

      if (session.media.length > 0) {
        mediaRef.current = session.media[0];
        setupMediaListeners(session.media[0]);
      }
    };

    const receiverListener = (availability: string) => {
      setState(prev => ({
        ...prev,
        isAvailable: availability === window.chrome.cast.ReceiverAvailability.AVAILABLE,
      }));
    };

    initializeCast();

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, []);

  const setupMediaListeners = useCallback((media: CastMedia) => {
    media.addUpdateListener((isAlive: boolean) => {
      if (isAlive) {
        setState(prev => ({
          ...prev,
          currentTime: media.getEstimatedTime(),
          duration: media.media?.duration || 0,
          isPlaying: media.playerState === 'PLAYING',
        }));
      }
    });

    // Update time every second
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
    }
    
    timeUpdateIntervalRef.current = setInterval(() => {
      const currentTime = media.getEstimatedTime();
      setState(prev => ({ ...prev, currentTime }));
      onTimeUpdate?.(currentTime);
    }, 1000);
  }, [onTimeUpdate]);

  const handleDisconnect = useCallback(() => {
    sessionRef.current = null;
    mediaRef.current = null;
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
    }
    setState(prev => ({
      ...prev,
      isConnected: false,
      deviceName: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }));
  }, []);

  const connect = useCallback(() => {
    if (!window.chrome?.cast) {
      toast.error('Google Cast not available');
      return;
    }

    window.chrome.cast.requestSession(
      (session: CastSession) => {
        sessionRef.current = session;
        setState(prev => ({
          ...prev,
          isConnected: true,
          deviceName: session.receiver.friendlyName,
        }));
        toast.success(`Connected to ${session.receiver.friendlyName}`);

        session.addUpdateListener((isAlive: boolean) => {
          if (!isAlive) {
            handleDisconnect();
          }
        });
      },
      (error: CastError) => {
        if (error.code !== 'cancel') {
          toast.error('Failed to connect to Cast device');
          console.error('Cast connect error:', error);
        }
      }
    );
  }, [handleDisconnect]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop(
        () => {
          handleDisconnect();
          toast.info('Disconnected from Cast device');
        },
        (error) => console.error('Disconnect error:', error)
      );
    }
  }, [handleDisconnect]);

  const loadMedia = useCallback((
    url?: string,
    title?: string,
    thumbnail?: string,
    startTime: number = 0
  ) => {
    const session = sessionRef.current;
    if (!session) {
      toast.error('No Cast session active');
      return;
    }

    const mediaUrlToLoad = url || mediaUrl;
    if (!mediaUrlToLoad) {
      toast.error('No media URL provided');
      return;
    }

    const mediaInfo = new window.chrome.cast.media.MediaInfo(mediaUrlToLoad, mediaType);
    mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
    mediaInfo.metadata.title = title || mediaTitle || 'Video';
    
    if (thumbnail || mediaThumbnail) {
      mediaInfo.metadata.images = [{ url: thumbnail || mediaThumbnail || '' }];
    }

    const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;
    request.currentTime = startTime;

    session.loadMedia(
      request,
      () => {
        if (session.media.length > 0) {
          mediaRef.current = session.media[0];
          setupMediaListeners(session.media[0]);
          toast.success('Now playing on ' + session.receiver.friendlyName);
        }
      },
      (error: CastError) => {
        toast.error('Failed to load media');
        console.error('Load media error:', error);
      }
    );
  }, [mediaUrl, mediaTitle, mediaThumbnail, mediaType, setupMediaListeners]);

  const play = useCallback(() => {
    const media = mediaRef.current;
    if (media) {
      media.play(null, () => {
        setState(prev => ({ ...prev, isPlaying: true }));
      }, (error) => console.error('Play error:', error));
    }
  }, []);

  const pause = useCallback(() => {
    const media = mediaRef.current;
    if (media) {
      media.pause(null, () => {
        setState(prev => ({ ...prev, isPlaying: false }));
      }, (error) => console.error('Pause error:', error));
    }
  }, []);

  const seek = useCallback((time: number) => {
    const media = mediaRef.current;
    if (media) {
      const request: SeekRequest = { currentTime: time };
      media.seek(request, () => {
        setState(prev => ({ ...prev, currentTime: time }));
      }, (error) => console.error('Seek error:', error));
    }
  }, []);

  const setVolume = useCallback((level: number) => {
    const session = sessionRef.current;
    if (session) {
      session.setReceiverVolumeLevel(level, () => {
        setState(prev => ({ ...prev, volume: level }));
      }, (error) => console.error('Volume error:', error));
    }
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    const session = sessionRef.current;
    if (session) {
      session.setReceiverMuted(muted, () => {
        setState(prev => ({ ...prev, isMuted: muted }));
      }, (error) => console.error('Mute error:', error));
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
  };
}
