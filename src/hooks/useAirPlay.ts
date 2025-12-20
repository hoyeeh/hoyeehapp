import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

interface AirPlayState {
  isAvailable: boolean;
  isConnected: boolean;
  deviceName: string | null;
}

interface UseAirPlayOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useAirPlay(options: UseAirPlayOptions = {}) {
  const { onConnect, onDisconnect } = options;
  
  const [state, setState] = useState<AirPlayState>({
    isAvailable: false,
    isConnected: false,
    deviceName: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Check if AirPlay is available (Safari/WebKit only)
  useEffect(() => {
    const checkAirPlayAvailability = () => {
      // AirPlay is available in Safari via the WebKit API
      const isWebKit = 'WebKitPlaybackTargetAvailabilityEvent' in window;
      const hasAirPlay = isWebKit || (window as any).WebKitPlaybackTargetAvailabilityEvent;
      
      setState(prev => ({
        ...prev,
        isAvailable: !!hasAirPlay,
      }));
    };

    checkAirPlayAvailability();
  }, []);

  // Set up video element for AirPlay
  const setupVideo = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    
    videoRef.current = video;

    // Listen for AirPlay availability
    video.addEventListener('webkitplaybacktargetavailabilitychanged', ((event: Event) => {
      const customEvent = event as CustomEvent<{ availability: string }>;
      const available = customEvent.detail?.availability === 'available';
      setState(prev => ({
        ...prev,
        isAvailable: available,
      }));
    }) as EventListener);

    // Listen for AirPlay connection changes
    video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', ((event: Event) => {
      const video = event.target as HTMLVideoElement;
      const isWireless = (video as any).webkitCurrentPlaybackTargetIsWireless;
      
      setState(prev => ({
        ...prev,
        isConnected: isWireless,
        deviceName: isWireless ? 'AirPlay Device' : null,
      }));

      if (isWireless) {
        toast.success('Connected to AirPlay');
        onConnect?.();
      } else {
        toast.info('Disconnected from AirPlay');
        onDisconnect?.();
      }
    }) as EventListener);
  }, [onConnect, onDisconnect]);

  // Show AirPlay picker
  const showPicker = useCallback(() => {
    const video = videoRef.current;
    
    if (!video) {
      toast.error('No video element available');
      return;
    }

    if ((video as any).webkitShowPlaybackTargetPicker) {
      (video as any).webkitShowPlaybackTargetPicker();
    } else {
      toast.error('AirPlay is not supported in this browser', {
        description: 'Please use Safari on Mac or iOS'
      });
    }
  }, []);

  // Disconnect from AirPlay
  const disconnect = useCallback(() => {
    // There's no direct API to disconnect - user must do it from control center
    // or by selecting a different output
    toast.info('To disconnect, use your device\'s AirPlay controls');
  }, []);

  // Check if current video is playing on AirPlay
  const checkConnection = useCallback(() => {
    const video = videoRef.current;
    if (video && (video as any).webkitCurrentPlaybackTargetIsWireless !== undefined) {
      const isWireless = (video as any).webkitCurrentPlaybackTargetIsWireless;
      setState(prev => ({
        ...prev,
        isConnected: isWireless,
      }));
      return isWireless;
    }
    return false;
  }, []);

  return {
    ...state,
    setupVideo,
    showPicker,
    disconnect,
    checkConnection,
    videoRef,
  };
}