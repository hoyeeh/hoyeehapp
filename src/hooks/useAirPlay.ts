import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface AirPlayState {
  isAvailable: boolean;
  isConnected: boolean;
  deviceName: string | null;
  isPlaying: boolean;
  volume: number;
  devicesNearby: boolean;
}

interface UseAirPlayOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onDevicesAvailable?: (available: boolean) => void;
  autoDetect?: boolean;
  showNotifications?: boolean;
}

// Extend HTMLVideoElement for WebKit-specific properties
interface WebKitVideoElement extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

// Remote Playback API types (simplified for casting)
interface RemotePlaybackLike {
  state: 'connected' | 'connecting' | 'disconnected';
  watchAvailability(callback: (available: boolean) => void): Promise<number>;
  cancelWatchAvailability(id?: number): Promise<void>;
  prompt(): Promise<void>;
  onconnecting?: ((ev: Event) => void) | null;
  onconnect?: ((ev: Event) => void) | null;
  ondisconnect?: ((ev: Event) => void) | null;
}

// We use 'any' for the remote property to avoid TS conflicts with lib.dom.d.ts
type VideoWithRemote = HTMLVideoElement & {
  remote?: RemotePlaybackLike;
};

// AirPlay 2 detection and control with Remote Playback API
export function useAirPlay(options: UseAirPlayOptions = {}) {
  const { 
    onConnect, 
    onDisconnect, 
    onPlayStateChange, 
    onDevicesAvailable,
    autoDetect = true,
    showNotifications = true
  } = options;

  const [state, setState] = useState<AirPlayState>({
    isAvailable: false,
    isConnected: false,
    deviceName: null,
    isPlaying: false,
    volume: 1,
    devicesNearby: false,
  });

  const videoRef = useRef<WebKitVideoElement | null>(null);
  const connectionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousConnectionRef = useRef<boolean>(false);
  const availabilityCallbackIdRef = useRef<number | null>(null);
  const hasNotifiedDevicesRef = useRef<boolean>(false);

  // Check if AirPlay is available (Safari/WebKit or Remote Playback API)
  const checkAvailability = useCallback(() => {
    // Check for WebKit's AirPlay support
    const hasWebkitPlaybackTarget = 'webkitShowPlaybackTargetPicker' in HTMLVideoElement.prototype;
    const hasWebkitWireless = 'webkitCurrentPlaybackTargetIsWireless' in HTMLVideoElement.prototype;
    
    // Check for the AirPlay API in newer Safari versions
    const hasAirPlayAPI = typeof (window as unknown as { WebKitPlaybackTargetAvailabilityEvent: unknown }).WebKitPlaybackTargetAvailabilityEvent !== 'undefined';
    
    // Check for Remote Playback API (Chrome/Edge for casting)
    const hasRemotePlayback = 'remote' in HTMLVideoElement.prototype;
    
    const isAvailable = hasWebkitPlaybackTarget || hasWebkitWireless || hasAirPlayAPI || hasRemotePlayback;
    
    setState(prev => ({ ...prev, isAvailable }));
    return isAvailable;
  }, []);

  // Initial availability check
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Setup Remote Playback API for automatic device detection
  const setupRemotePlayback = useCallback((video: VideoWithRemote) => {
    if (!video.remote) return;

    const remote = video.remote;

    // Watch for device availability
    remote.watchAvailability((available) => {
      console.log('[AirPlay] Device availability changed:', available);
      
      setState(prev => ({ ...prev, devicesNearby: available }));
      onDevicesAvailable?.(available);
      
      // Show notification when devices become available (only once per session)
      if (available && !hasNotifiedDevicesRef.current && showNotifications) {
        hasNotifiedDevicesRef.current = true;
        toast.info('AirPlay devices available nearby', {
          description: 'Tap the AirPlay button to cast',
          duration: 5000,
        });
      }
    }).then((id) => {
      availabilityCallbackIdRef.current = id;
    }).catch((error) => {
      console.log('[AirPlay] watchAvailability not supported:', error.message);
    });

    // Connection state events
    remote.onconnecting = () => {
      console.log('[AirPlay] Connecting to device...');
      if (showNotifications) {
        toast.loading('Connecting to AirPlay device...');
      }
    };

    remote.onconnect = () => {
      console.log('[AirPlay] Connected to device');
      setState(prev => ({
        ...prev,
        isConnected: true,
        deviceName: 'AirPlay Device',
      }));
      onConnect?.();
      if (showNotifications) {
        toast.success('Connected to AirPlay device');
      }
    };

    remote.ondisconnect = () => {
      console.log('[AirPlay] Disconnected from device');
      setState(prev => ({
        ...prev,
        isConnected: false,
        deviceName: null,
      }));
      onDisconnect?.();
    };
  }, [onConnect, onDisconnect, onDevicesAvailable, showNotifications]);

  // Setup video element with AirPlay event listeners
  const setupVideo = useCallback((video: HTMLVideoElement | null) => {
    const webkitVideo = video as WebKitVideoElement;
    const remoteVideo = video as VideoWithRemote;
    
    if (!webkitVideo) {
      // Cleanup previous
      if (videoRef.current && availabilityCallbackIdRef.current !== null) {
        const prevRemote = (videoRef.current as VideoWithRemote).remote;
        if (prevRemote) {
          prevRemote.cancelWatchAvailability(availabilityCallbackIdRef.current).catch(() => {});
        }
      }
      videoRef.current = null;
      return;
    }

    videoRef.current = webkitVideo;

    // Enable remote playback
    if (remoteVideo.disableRemotePlayback !== undefined) {
      remoteVideo.disableRemotePlayback = false;
    }

    // Check initial availability
    const isAvailable = checkAvailability();
    if (!isAvailable) return;

    // Setup Remote Playback API if available
    if (remoteVideo.remote) {
      setupRemotePlayback(remoteVideo);
    }

    // Listen for AirPlay availability changes (WebKit)
    const handleTargetAvailability = (event: Event) => {
      const customEvent = event as CustomEvent<{ availability: string }>;
      const availability = customEvent.detail?.availability || (event as { availability?: string }).availability;
      const available = availability === 'available';
      
      setState(prev => ({ ...prev, isAvailable: available, devicesNearby: available }));
      onDevicesAvailable?.(available);
      
      if (available && !hasNotifiedDevicesRef.current && showNotifications) {
        hasNotifiedDevicesRef.current = true;
        toast.info('AirPlay devices available', {
          description: 'Tap the AirPlay button to cast',
          duration: 5000,
        });
      }
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
          if (showNotifications) {
            toast.success('Connected to AirPlay device');
          }
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
      
      // Cleanup Remote Playback API
      if (availabilityCallbackIdRef.current !== null && remoteVideo.remote) {
        remoteVideo.remote.cancelWatchAvailability(availabilityCallbackIdRef.current).catch(() => {});
      }
    };
  }, [checkAvailability, onConnect, onDisconnect, onPlayStateChange, onDevicesAvailable, setupRemotePlayback, showNotifications]);

  // Show AirPlay device picker
  const showPicker = useCallback(() => {
    const video = videoRef.current;
    const remoteVideo = video as VideoWithRemote;
    
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
      // Try Remote Playback API first (for Chrome Cast support)
      if (remoteVideo.remote && remoteVideo.remote.prompt) {
        remoteVideo.remote.prompt().catch((error) => {
          console.log('[AirPlay] Remote prompt failed, trying WebKit:', error.message);
          // Fall back to WebKit
          if (video.webkitShowPlaybackTargetPicker) {
            video.webkitShowPlaybackTargetPicker();
          }
        });
        return;
      }
      
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
    const remoteVideo = video as VideoWithRemote;
    
    if (!video) return false;

    // Check Remote Playback API state
    if (remoteVideo.remote) {
      const isRemote = remoteVideo.remote.state === 'connected';
      if (isRemote !== state.isConnected) {
        setState(prev => ({
          ...prev,
          isConnected: isRemote,
          deviceName: isRemote ? 'Cast Device' : null,
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
    }

    // Check WebKit state
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

  // Reset notification flag when video changes
  const resetNotifications = useCallback(() => {
    hasNotifiedDevicesRef.current = false;
  }, []);

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
    resetNotifications,
    // Playback controls
    play,
    pause,
    setVolume,
    seek,
    // Video ref for direct access
    videoElement: videoRef.current,
  };
}
