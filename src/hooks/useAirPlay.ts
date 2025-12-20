import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface AirPlayState {
  isAvailable: boolean;
  isConnected: boolean;
  deviceName: string | null;
  isPlaying: boolean;
  volume: number;
}

interface UseAirPlayOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  autoDetect?: boolean;
}

// Extend HTMLVideoElement for WebKit-specific properties
interface WebKitVideoElement extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

// AirPlay 2 detection and control
export function useAirPlay(options: UseAirPlayOptions = {}) {
  const { onConnect, onDisconnect, onPlayStateChange, autoDetect = true } = options;

  const [state, setState] = useState<AirPlayState>({
    isAvailable: false,
    isConnected: false,
    deviceName: null,
    isPlaying: false,
    volume: 1,
  });

  const videoRef = useRef<WebKitVideoElement | null>(null);
  const connectionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousConnectionRef = useRef<boolean>(false);

  // Check if AirPlay is available (Safari/WebKit only)
  const checkAvailability = useCallback(() => {
    // Check for WebKit's AirPlay support
    const hasWebkitPlaybackTarget = 'webkitShowPlaybackTargetPicker' in HTMLVideoElement.prototype;
    const hasWebkitWireless = 'webkitCurrentPlaybackTargetIsWireless' in HTMLVideoElement.prototype;
    
    // Also check for the AirPlay API in newer Safari versions
    const hasAirPlayAPI = typeof (window as unknown as { WebKitPlaybackTargetAvailabilityEvent: unknown }).WebKitPlaybackTargetAvailabilityEvent !== 'undefined';
    
    const isAvailable = hasWebkitPlaybackTarget || hasWebkitWireless || hasAirPlayAPI;
    
    setState(prev => ({ ...prev, isAvailable }));
    return isAvailable;
  }, []);

  // Initial availability check
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Setup video element with AirPlay event listeners
  const setupVideo = useCallback((video: HTMLVideoElement | null) => {
    const webkitVideo = video as WebKitVideoElement;
    
    if (!webkitVideo) {
      videoRef.current = null;
      return;
    }

    videoRef.current = webkitVideo;

    // Check initial availability
    const isAvailable = checkAvailability();
    if (!isAvailable) return;

    // Listen for AirPlay availability changes
    const handleTargetAvailability = (event: Event) => {
      const customEvent = event as CustomEvent<{ availability: string }>;
      const availability = customEvent.detail?.availability || (event as { availability?: string }).availability;
      const available = availability === 'available';
      
      setState(prev => ({ ...prev, isAvailable: available }));
    };

    // Listen for wireless playback target changes (AirPlay 2)
    const handlePlayingRemotely = () => {
      const isRemote = webkitVideo.webkitCurrentPlaybackTargetIsWireless || false;
      
      if (isRemote !== previousConnectionRef.current) {
        previousConnectionRef.current = isRemote;
        
        setState(prev => ({
          ...prev,
          isConnected: isRemote,
          deviceName: isRemote ? 'AirPlay Device' : null,
        }));

        if (isRemote) {
          onConnect?.();
          toast.success('Connected to AirPlay device');
        } else {
          onDisconnect?.();
        }
      }
    };

    // Listen for play state changes
    const handlePlayStateChange = () => {
      const isPlaying = !webkitVideo.paused;
      setState(prev => {
        if (prev.isPlaying !== isPlaying) {
          onPlayStateChange?.(isPlaying);
        }
        return { ...prev, isPlaying };
      });
    };

    // Listen for volume changes
    const handleVolumeChange = () => {
      setState(prev => ({ ...prev, volume: webkitVideo.volume }));
    };

    // Add event listeners
    webkitVideo.addEventListener('webkitplaybacktargetavailabilitychanged', handleTargetAvailability);
    webkitVideo.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handlePlayingRemotely);
    webkitVideo.addEventListener('play', handlePlayStateChange);
    webkitVideo.addEventListener('pause', handlePlayStateChange);
    webkitVideo.addEventListener('volumechange', handleVolumeChange);

    // Check initial connection state
    if (webkitVideo.webkitCurrentPlaybackTargetIsWireless) {
      handlePlayingRemotely();
    }

    return () => {
      webkitVideo.removeEventListener('webkitplaybacktargetavailabilitychanged', handleTargetAvailability);
      webkitVideo.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handlePlayingRemotely);
      webkitVideo.removeEventListener('play', handlePlayStateChange);
      webkitVideo.removeEventListener('pause', handlePlayStateChange);
      webkitVideo.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [checkAvailability, onConnect, onDisconnect, onPlayStateChange]);

  // Show AirPlay device picker
  const showPicker = useCallback(() => {
    const video = videoRef.current;
    
    if (!video) {
      console.warn('[AirPlay] No video element set up');
      toast.error('Please start playing a video first');
      return;
    }

    if (!state.isAvailable) {
      toast.error('AirPlay is not available. Use Safari on Mac or iOS.');
      return;
    }

    try {
      // Use WebKit's playback target picker
      if (video.webkitShowPlaybackTargetPicker) {
        video.webkitShowPlaybackTargetPicker();
      } else {
        toast.error('AirPlay picker not available');
      }
    } catch (error) {
      console.error('[AirPlay] Failed to show picker:', error);
      toast.error('Failed to open AirPlay picker');
    }
  }, [state.isAvailable]);

  // Disconnect from AirPlay (user must use system controls)
  const disconnect = useCallback(() => {
    // AirPlay disconnection must be done through system UI
    toast.info('Use Control Center or the AirPlay menu to disconnect');
  }, []);

  // Check current connection status
  const checkConnection = useCallback(() => {
    const video = videoRef.current;
    if (!video) return false;

    const isRemote = video.webkitCurrentPlaybackTargetIsWireless || false;
    
    if (isRemote !== state.isConnected) {
      setState(prev => ({
        ...prev,
        isConnected: isRemote,
        deviceName: isRemote ? 'AirPlay Device' : null,
      }));
      
      if (isRemote && !previousConnectionRef.current) {
        previousConnectionRef.current = true;
        onConnect?.();
      } else if (!isRemote && previousConnectionRef.current) {
        previousConnectionRef.current = false;
        onDisconnect?.();
      }
    }

    return isRemote;
  }, [state.isConnected, onConnect, onDisconnect]);

  // Auto-detect connection changes
  useEffect(() => {
    if (!autoDetect) return;

    connectionCheckRef.current = setInterval(() => {
      checkConnection();
    }, 2000);

    return () => {
      if (connectionCheckRef.current) {
        clearInterval(connectionCheckRef.current);
      }
    };
  }, [autoDetect, checkConnection]);

  // Playback controls (when connected to AirPlay)
  const play = useCallback(() => {
    videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  return {
    ...state,
    setupVideo,
    showPicker,
    disconnect,
    checkConnection,
    // Playback controls
    play,
    pause,
    setVolume,
    seek,
    // Video ref for direct access
    videoElement: videoRef.current,
  };
}
