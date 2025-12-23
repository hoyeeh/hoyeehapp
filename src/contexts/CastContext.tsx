import { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useUniversalCast, CastDevice, PlaybackState, QueueItem } from '@/hooks/useUniversalCast';
import { useGoogleCast } from '@/hooks/useGoogleCast';
import { useAirPlay } from '@/hooks/useAirPlay';
import { useDLNA, DLNADevice } from '@/hooks/useDLNA';
import { CastControlBar } from '@/components/cast/CastControlBar';
import { CastMiniPlayer } from '@/components/cast/CastMiniPlayer';

// Chromecast interface
interface ChromecastState {
  isAvailable: boolean;
  isConnected: boolean;
  deviceName: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  loadMedia: (url: string, title: string, thumbnail?: string, startTime?: number) => Promise<void>;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (level: number) => void;
  // Platform limitations
  platformWarning: string | null;
}

// AirPlay interface
interface AirPlayState {
  isAvailable: boolean;
  isConnected: boolean;
  deviceName: string | null;
  setupVideo: (video: HTMLVideoElement | null) => void;
  showPicker: () => void;
  disconnect: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (level: number) => void;
}

// DLNA interface
interface DLNAState {
  isScanning: boolean;
  devices: DLNADevice[];
  connectedDevice: DLNADevice | null;
  savedDevices: SavedDLNADevice[];
  scanForDevices: () => Promise<void>;
  connect: (device: DLNADevice) => Promise<void>;
  disconnect: () => void;
  playMedia: (url: string, title?: string, startTime?: number) => Promise<void>;
  addManualDevice: (device: SavedDLNADevice) => void;
  removeManualDevice: (deviceId: string) => void;
  // Platform limitations
  platformWarning: string | null;
}

interface SavedDLNADevice {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
}

type ActiveConnectionType = 'chromecast' | 'airplay' | 'dlna' | 'remote' | null;

interface CastContextType {
  // Universal Cast (TV Code pairing)
  isConnecting: boolean;
  isConnected: boolean;
  connectedDevice: CastDevice | null;
  sessionId: string | null;
  playbackState: PlaybackState;
  pairedDevices: CastDevice[];

  // Connection methods
  pairWithCode: (code: string) => Promise<boolean>;
  reconnectToDevice: (device: CastDevice) => Promise<boolean>;
  disconnect: () => void;
  removePairedDevice: (deviceId: string) => void;

  // Playback methods
  loadVideo: (videoUrl: string, title: string, thumbnail?: string, duration?: number, startTime?: number) => Promise<void>;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  stop: () => void;
  updateQueue: (queue: QueueItem[]) => void;

  // Chromecast
  chromecast: ChromecastState;

  // AirPlay
  airPlay: AirPlayState;

  // DLNA / Smart TV
  dlna: DLNAState;

  // Video element registration for AirPlay
  registerVideoElement: (video: HTMLVideoElement | null) => void;

  // Unified methods
  getActiveConnection: () => { type: ActiveConnectionType; device: string | null };
  disconnectAll: () => void;
}

const CastContext = createContext<CastContextType | null>(null);

export function useCast() {
  const context = useContext(CastContext);
  if (!context) {
    throw new Error('useCast must be used within a CastProvider');
  }
  return context;
}

// Saved DLNA devices storage key
const SAVED_DLNA_DEVICES_KEY = 'hoyeeh-saved-dlna-devices';

interface CastProviderProps {
  children: ReactNode;
}

export function CastProvider({ children }: CastProviderProps) {
  const cast = useUniversalCast();
  const googleCast = useGoogleCast();
  const airPlayHook = useAirPlay();
  const dlnaHook = useDLNA();
  const location = useLocation();
  
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedDLNADevices, setSavedDLNADevices] = useState<SavedDLNADevice[]>([]);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Load saved DLNA devices from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_DLNA_DEVICES_KEY);
      if (saved) {
        setSavedDLNADevices(JSON.parse(saved));
      }
    } catch (error) {
      console.error('[CastContext] Failed to load saved DLNA devices:', error);
    }
  }, []);

  // Detect platform limitations for Chromecast
  const getChromecastWarning = useCallback((): string | null => {
    const isMobileWeb = /iPhone|iPad|Android/i.test(navigator.userAgent);
    const isChromeBrowser = /Chrome/.test(navigator.userAgent) && !/Edge|Edg/.test(navigator.userAgent);
    
    if (isMobileWeb) {
      return 'Chromecast discovery requires the native mobile app. Web browsers on mobile cannot discover Cast devices.';
    }
    if (!isChromeBrowser) {
      return 'Chromecast requires Google Chrome browser on desktop.';
    }
    return null;
  }, []);

  // Detect platform limitations for DLNA
  const getDLNAWarning = useCallback((): string | null => {
    return 'Automatic DLNA device discovery is not available in web browsers due to security restrictions. Please add your Smart TV manually using its IP address.';
  }, []);

  // Register video element for AirPlay
  const registerVideoElement = useCallback((video: HTMLVideoElement | null) => {
    videoElementRef.current = video;
    airPlayHook.setupVideo(video);
  }, [airPlayHook]);

  // Add manual DLNA device
  const addManualDevice = useCallback((device: SavedDLNADevice) => {
    setSavedDLNADevices(prev => {
      const updated = prev.filter(d => d.id !== device.id);
      updated.push(device);
      localStorage.setItem(SAVED_DLNA_DEVICES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Remove manual DLNA device
  const removeManualDevice = useCallback((deviceId: string) => {
    setSavedDLNADevices(prev => {
      const updated = prev.filter(d => d.id !== deviceId);
      localStorage.setItem(SAVED_DLNA_DEVICES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Get active connection across all casting methods
  const getActiveConnection = useCallback((): { type: ActiveConnectionType; device: string | null } => {
    if (cast.isConnected && cast.connectedDevice) {
      return { type: 'remote', device: cast.connectedDevice.name };
    }
    if (googleCast.isConnected && googleCast.deviceName) {
      return { type: 'chromecast', device: googleCast.deviceName };
    }
    if (airPlayHook.isConnected) {
      return { type: 'airplay', device: airPlayHook.deviceName || 'AirPlay Device' };
    }
    if (dlnaHook.connectedDevice) {
      return { type: 'dlna', device: dlnaHook.connectedDevice.name };
    }
    return { type: null, device: null };
  }, [cast.isConnected, cast.connectedDevice, googleCast.isConnected, googleCast.deviceName, airPlayHook.isConnected, airPlayHook.deviceName, dlnaHook.connectedDevice]);

  // Disconnect all casting sessions
  const disconnectAll = useCallback(() => {
    cast.disconnect();
    googleCast.disconnect();
    airPlayHook.disconnect();
    dlnaHook.disconnect();
  }, [cast, googleCast, airPlayHook, dlnaHook]);

  // Show mini player when not on content detail page and casting is active
  useEffect(() => {
    const isOnContentPage = location.pathname.startsWith('/content/');
    const { type } = getActiveConnection();
    const hasActiveMedia = type !== null && cast.playbackState.videoUrl;
    
    if (hasActiveMedia && !isOnContentPage && !isExpanded) {
      setShowMiniPlayer(true);
    } else if (isOnContentPage || isExpanded) {
      setShowMiniPlayer(false);
    }
  }, [location.pathname, getActiveConnection, cast.playbackState.videoUrl, isExpanded]);

  const handleExpand = () => {
    setIsExpanded(true);
    setShowMiniPlayer(false);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  // Build the chromecast interface
  const chromecastInterface: ChromecastState = {
    isAvailable: googleCast.isAvailable,
    isConnected: googleCast.isConnected,
    deviceName: googleCast.deviceName,
    isPlaying: googleCast.isPlaying,
    currentTime: googleCast.currentTime,
    duration: googleCast.duration,
    connect: googleCast.connect,
    disconnect: googleCast.disconnect,
    loadMedia: googleCast.loadMedia,
    play: () => {
      // Chromecast play is handled by loadMedia
    },
    pause: googleCast.pause,
    seek: googleCast.seek,
    setVolume: googleCast.setVolume,
    platformWarning: getChromecastWarning(),
  };

  // Build the AirPlay interface
  const airPlayInterface: AirPlayState = {
    isAvailable: airPlayHook.isAvailable,
    isConnected: airPlayHook.isConnected,
    deviceName: airPlayHook.deviceName,
    setupVideo: airPlayHook.setupVideo,
    showPicker: airPlayHook.showPicker,
    disconnect: airPlayHook.disconnect,
    play: airPlayHook.play,
    pause: airPlayHook.pause,
    seek: airPlayHook.seek,
    setVolume: airPlayHook.setVolume,
  };

  // Build the DLNA interface
  const dlnaInterface: DLNAState = {
    isScanning: dlnaHook.isScanning,
    devices: dlnaHook.devices,
    connectedDevice: dlnaHook.connectedDevice,
    savedDevices: savedDLNADevices,
    scanForDevices: dlnaHook.scanForDevices,
    connect: dlnaHook.connectToDevice,
    disconnect: dlnaHook.disconnect,
    playMedia: dlnaHook.playMedia,
    addManualDevice,
    removeManualDevice,
    platformWarning: getDLNAWarning(),
  };

  const contextValue: CastContextType = {
    // Universal Cast
    isConnecting: cast.isConnecting,
    isConnected: cast.isConnected,
    connectedDevice: cast.connectedDevice,
    sessionId: cast.sessionId,
    playbackState: cast.playbackState,
    pairedDevices: cast.pairedDevices,

    // Connection methods
    pairWithCode: cast.pairWithCode,
    reconnectToDevice: cast.reconnectToDevice,
    disconnect: cast.disconnect,
    removePairedDevice: cast.removePairedDevice,

    // Playback methods
    loadVideo: cast.loadVideo,
    play: cast.play,
    pause: cast.pause,
    seek: cast.seek,
    setVolume: cast.setVolume,
    stop: cast.stop,
    updateQueue: cast.updateQueue,

    // Casting methods
    chromecast: chromecastInterface,
    airPlay: airPlayInterface,
    dlna: dlnaInterface,

    // Video registration
    registerVideoElement,

    // Unified methods
    getActiveConnection,
    disconnectAll,
  };

  return (
    <CastContext.Provider value={contextValue}>
      {children}
      
      {/* Mini Player - shows when navigating away from content while casting */}
      {showMiniPlayer && cast.connectedDevice && (
        <CastMiniPlayer
          device={cast.connectedDevice}
          playbackState={cast.playbackState}
          onPlay={cast.play}
          onPause={cast.pause}
          onVolumeChange={cast.setVolume}
          onStop={cast.stop}
          onExpand={handleExpand}
        />
      )}
      
      {/* Full Cast Control Bar - shows when expanded or on content page */}
      {(isExpanded || location.pathname.startsWith('/content/')) && cast.isConnected && cast.connectedDevice && (
        <CastControlBar
          device={cast.connectedDevice}
          playbackState={cast.playbackState}
          onPlay={cast.play}
          onPause={cast.pause}
          onSeek={cast.seek}
          onVolumeChange={cast.setVolume}
          onStop={() => {
            cast.stop();
            handleCollapse();
          }}
          onDisconnect={cast.disconnect}
        />
      )}
    </CastContext.Provider>
  );
}
