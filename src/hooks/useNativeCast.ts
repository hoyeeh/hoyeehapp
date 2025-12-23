import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';

interface NativeCastDevice {
  id: string;
  name: string;
  modelName: string;
}

interface NativeCastState {
  isAvailable: boolean;
  isConnected: boolean;
  isScanning: boolean;
  deviceName: string | null;
  devices: NativeCastDevice[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

interface UseNativeCastOptions {
  onTimeUpdate?: (currentTime: number) => void;
  onConnectionChange?: (connected: boolean) => void;
  onMediaStatusChange?: (isPlaying: boolean) => void;
}

// Native bridge interface for Capacitor plugins
interface CastPlugin {
  initialize(): Promise<void>;
  isAvailable(): Promise<{ available: boolean }>;
  showDevicePicker(): Promise<{ deviceId?: string; deviceName?: string }>;
  connect(options: { deviceId: string }): Promise<void>;
  disconnect(): Promise<void>;
  loadMedia(options: {
    url: string;
    title?: string;
    thumbnail?: string;
    contentType?: string;
    startTime?: number;
  }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(options: { position: number }): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  getMediaStatus(): Promise<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
  }>;
  addListener(
    eventName: string,
    callback: (data: unknown) => void
  ): Promise<{ remove: () => void }>;
}

// Check if running in native context
const isNative = Capacitor.isNativePlatform();

// Mock plugin for web fallback
const mockCastPlugin: CastPlugin = {
  initialize: async () => {},
  isAvailable: async () => ({ available: false }),
  showDevicePicker: async () => ({}),
  connect: async () => {},
  disconnect: async () => {},
  loadMedia: async () => {},
  play: async () => {},
  pause: async () => {},
  seek: async () => {},
  setVolume: async () => {},
  getMediaStatus: async () => ({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  }),
  addListener: async () => ({ remove: () => {} }),
};

// Get the Cast plugin (will be registered by native code)
const getCastPlugin = (): CastPlugin => {
  if (isNative && (window as unknown as { Capacitor?: { Plugins?: { GoogleCast?: CastPlugin } } }).Capacitor?.Plugins?.GoogleCast) {
    return (window as unknown as { Capacitor: { Plugins: { GoogleCast: CastPlugin } } }).Capacitor.Plugins.GoogleCast;
  }
  return mockCastPlugin;
};

export function useNativeCast(options: UseNativeCastOptions = {}) {
  const { onTimeUpdate, onConnectionChange, onMediaStatusChange } = options;
  
  const [state, setState] = useState<NativeCastState>({
    isAvailable: false,
    isConnected: false,
    isScanning: false,
    deviceName: null,
    devices: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
  });

  const listenersRef = useRef<{ remove: () => void }[]>([]);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pluginRef = useRef<CastPlugin>(getCastPlugin());

  // Initialize cast SDK
  const initialize = useCallback(async () => {
    if (!isNative) {
      console.log('[NativeCast] Not running in native context');
      return;
    }

    try {
      const plugin = pluginRef.current;
      await plugin.initialize();
      
      const { available } = await plugin.isAvailable();
      setState(prev => ({ ...prev, isAvailable: available }));
      
      console.log('[NativeCast] Initialized, available:', available);
    } catch (error) {
      console.error('[NativeCast] Initialization error:', error);
    }
  }, []);

  // Set up event listeners
  const setupListeners = useCallback(async () => {
    if (!isNative) return;

    const plugin = pluginRef.current;

    try {
      // Connection state change
      const connectionListener = await plugin.addListener(
        'castStateChanged',
        (data: unknown) => {
          const castData = data as { connected: boolean; deviceName?: string };
          setState(prev => ({
            ...prev,
            isConnected: castData.connected,
            deviceName: castData.deviceName || null,
          }));
          onConnectionChange?.(castData.connected);
          
          if (castData.connected) {
            toast.success(`Connected to ${castData.deviceName}`);
          }
        }
      );
      listenersRef.current.push(connectionListener);

      // Media status change
      const mediaListener = await plugin.addListener(
        'mediaStatusChanged',
        (data: unknown) => {
          const mediaData = data as { isPlaying: boolean; currentTime: number; duration: number };
          setState(prev => ({
            ...prev,
            isPlaying: mediaData.isPlaying,
            currentTime: mediaData.currentTime,
            duration: mediaData.duration,
          }));
          onMediaStatusChange?.(mediaData.isPlaying);
          onTimeUpdate?.(mediaData.currentTime);
        }
      );
      listenersRef.current.push(mediaListener);

      // Device discovery
      const discoveryListener = await plugin.addListener(
        'devicesDiscovered',
        (data: unknown) => {
          const deviceData = data as { devices: NativeCastDevice[] };
          setState(prev => ({
            ...prev,
            devices: deviceData.devices,
            isScanning: false,
          }));
        }
      );
      listenersRef.current.push(discoveryListener);

    } catch (error) {
      console.error('[NativeCast] Failed to set up listeners:', error);
    }
  }, [onConnectionChange, onMediaStatusChange, onTimeUpdate]);

  // Initialize on mount
  useEffect(() => {
    initialize();
    setupListeners();

    return () => {
      // Clean up listeners
      listenersRef.current.forEach(listener => listener.remove());
      listenersRef.current = [];
      
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [initialize, setupListeners]);

  // Show device picker (native dialog)
  const showDevicePicker = useCallback(async () => {
    if (!isNative) {
      toast.error('Cast requires native app. Use the TV Code feature instead.');
      return null;
    }

    try {
      const plugin = pluginRef.current;
      const result = await plugin.showDevicePicker();
      
      if (result.deviceId) {
        await plugin.connect({ deviceId: result.deviceId });
        return result;
      }
      return null;
    } catch (error) {
      console.error('[NativeCast] Device picker error:', error);
      toast.error('Failed to open device picker');
      return null;
    }
  }, []);

  // Connect to specific device
  const connect = useCallback(async (deviceId: string) => {
    if (!isNative) return;

    try {
      const plugin = pluginRef.current;
      await plugin.connect({ deviceId });
    } catch (error) {
      console.error('[NativeCast] Connect error:', error);
      toast.error('Failed to connect to device');
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      const plugin = pluginRef.current;
      await plugin.disconnect();
      setState(prev => ({
        ...prev,
        isConnected: false,
        deviceName: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
      }));
      onConnectionChange?.(false);
      toast.info('Disconnected from Cast device');
    } catch (error) {
      console.error('[NativeCast] Disconnect error:', error);
    }
  }, [onConnectionChange]);

  // Load media
  const loadMedia = useCallback(async (
    url: string,
    title?: string,
    thumbnail?: string,
    contentType: string = 'video/mp4',
    startTime: number = 0
  ) => {
    if (!state.isConnected) {
      toast.error('Not connected to a Cast device');
      return;
    }

    try {
      const plugin = pluginRef.current;
      await plugin.loadMedia({
        url,
        title,
        thumbnail,
        contentType,
        startTime,
      });
      
      // Start polling for status updates
      if (!statusIntervalRef.current) {
        statusIntervalRef.current = setInterval(async () => {
          try {
            const status = await plugin.getMediaStatus();
            setState(prev => ({
              ...prev,
              isPlaying: status.isPlaying,
              currentTime: status.currentTime,
              duration: status.duration,
              volume: status.volume,
            }));
            onTimeUpdate?.(status.currentTime);
          } catch {
            // Ignore polling errors
          }
        }, 1000);
      }
    } catch (error) {
      console.error('[NativeCast] Load media error:', error);
      toast.error('Failed to cast media');
    }
  }, [state.isConnected, onTimeUpdate]);

  // Playback controls
  const play = useCallback(async () => {
    try {
      await pluginRef.current.play();
      setState(prev => ({ ...prev, isPlaying: true }));
    } catch (error) {
      console.error('[NativeCast] Play error:', error);
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await pluginRef.current.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    } catch (error) {
      console.error('[NativeCast] Pause error:', error);
    }
  }, []);

  const seek = useCallback(async (position: number) => {
    try {
      await pluginRef.current.seek({ position });
      setState(prev => ({ ...prev, currentTime: position }));
    } catch (error) {
      console.error('[NativeCast] Seek error:', error);
    }
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    try {
      await pluginRef.current.setVolume({ volume });
      setState(prev => ({ ...prev, volume }));
    } catch (error) {
      console.error('[NativeCast] Volume error:', error);
    }
  }, []);

  // Check if native casting is supported
  const isNativeSupported = isNative;

  return {
    ...state,
    isNativeSupported,
    showDevicePicker,
    connect,
    disconnect,
    loadMedia,
    play,
    pause,
    seek,
    setVolume,
    initialize,
  };
}
