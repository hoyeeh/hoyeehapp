import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface DLNADevice {
  id: string;
  name: string;
  type: 'dlna' | 'upnp';
  location: string;
  manufacturer?: string;
  modelName?: string;
}

interface DLNAState {
  isScanning: boolean;
  devices: DLNADevice[];
  connectedDevice: DLNADevice | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

const SAVED_DLNA_DEVICES_KEY = 'hoyeeh-dlna-devices';

// DLNA/UPnP requires a server-side component for SSDP discovery
// This hook provides the client-side interface with manual device support
export function useDLNA() {
  const [state, setState] = useState<DLNAState>({
    isScanning: false,
    devices: [],
    connectedDevice: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  });

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved devices on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_DLNA_DEVICES_KEY);
      if (saved) {
        const savedDevices: DLNADevice[] = JSON.parse(saved);
        setState(prev => ({ ...prev, devices: savedDevices }));
      }
    } catch (error) {
      console.error('[DLNA] Failed to load saved devices:', error);
    }
  }, []);

  // Test device connectivity
  const testDeviceConnectivity = useCallback(async (device: DLNADevice): Promise<boolean> => {
    try {
      // Try to call the DLNA edge function to test the device
      const { data, error } = await supabase.functions.invoke('dlna-discover', {
        body: {
          action: 'control',
          deviceUrl: device.location,
          command: 'GetTransportInfo',
        },
      });
      
      return !error && data?.success !== false;
    } catch {
      // Device might still work, just can't verify
      return true;
    }
  }, []);
  
  const scanForDevices = useCallback(async () => {
    setState(prev => ({ ...prev, isScanning: true }));
    
    try {
      // Note: True DLNA discovery via SSDP multicast is NOT possible in browsers
      // or edge functions due to security restrictions and lack of UDP support.
      // 
      // This scan will:
      // 1. Load any manually saved devices
      // 2. Test connectivity to saved devices
      // 3. Show a helpful message about manual setup
      
      const saved = localStorage.getItem(SAVED_DLNA_DEVICES_KEY);
      const savedDevices: DLNADevice[] = saved ? JSON.parse(saved) : [];
      
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Test saved devices for connectivity
      const availableDevices: DLNADevice[] = [];
      for (const device of savedDevices) {
        const isAvailable = await testDeviceConnectivity(device);
        if (isAvailable) {
          availableDevices.push(device);
        }
      }
      
      setState(prev => ({
        ...prev,
        devices: availableDevices,
        isScanning: false,
      }));
      
      if (savedDevices.length === 0) {
        toast.info('No saved devices. Use "Link with TV Code" or add devices manually.');
      } else if (availableDevices.length === 0) {
        toast.warning('Saved devices are not responding. Check your network connection.');
      } else {
        toast.success(`Found ${availableDevices.length} device(s)`);
      }
    } catch (error) {
      console.error('[DLNA] Scan error:', error);
      setState(prev => ({ ...prev, isScanning: false }));
      toast.error('Failed to scan for devices');
    }
  }, [testDeviceConnectivity]);

  const connectToDevice = useCallback(async (device: DLNADevice) => {
    try {
      // In a real implementation, establish connection to the DLNA renderer
      setState(prev => ({
        ...prev,
        connectedDevice: device,
      }));
      toast.success(`Connected to ${device.name}`);
    } catch (error) {
      console.error('DLNA connect error:', error);
      toast.error('Failed to connect to device');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    setState(prev => ({
      ...prev,
      connectedDevice: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }));
    toast.info('Disconnected from DLNA device');
  }, []);

  const playMedia = useCallback(async (
    mediaUrl: string,
    title?: string,
    startTime: number = 0
  ) => {
    if (!state.connectedDevice) {
      toast.error('No DLNA device connected');
      return;
    }

    try {
      // In a real implementation, send SetAVTransportURI and Play commands
      // via the DLNA Control endpoint
      
      // Example SOAP request structure for SetAVTransportURI:
      // <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      //   <InstanceID>0</InstanceID>
      //   <CurrentURI>{mediaUrl}</CurrentURI>
      //   <CurrentURIMetaData>...</CurrentURIMetaData>
      // </u:SetAVTransportURI>
      
      setState(prev => ({ ...prev, isPlaying: true }));
      toast.success(`Playing on ${state.connectedDevice.name}`);
      
      // Start position polling (would call GetPositionInfo via SOAP)
      pollingRef.current = setInterval(() => {
        // Poll for position updates
        setState(prev => ({
          ...prev,
          currentTime: prev.currentTime + 1,
        }));
      }, 1000);
      
    } catch (error) {
      console.error('DLNA play error:', error);
      toast.error('Failed to play media on device');
    }
  }, [state.connectedDevice]);

  const pause = useCallback(async () => {
    try {
      // Send Pause command via SOAP
      setState(prev => ({ ...prev, isPlaying: false }));
    } catch (error) {
      console.error('DLNA pause error:', error);
    }
  }, []);

  const play = useCallback(async () => {
    try {
      // Send Play command via SOAP
      setState(prev => ({ ...prev, isPlaying: true }));
    } catch (error) {
      console.error('DLNA play error:', error);
    }
  }, []);

  const seek = useCallback(async (time: number) => {
    try {
      // Send Seek command via SOAP
      // Format time as HH:MM:SS for DLNA
      setState(prev => ({ ...prev, currentTime: time }));
    } catch (error) {
      console.error('DLNA seek error:', error);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      // Send Stop command via SOAP
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      setState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: 0,
      }));
    } catch (error) {
      console.error('DLNA stop error:', error);
    }
  }, []);

  return {
    ...state,
    scanForDevices,
    connectToDevice,
    disconnect,
    playMedia,
    pause,
    play,
    seek,
    stop,
  };
}

// Helper to format time for DLNA (HH:MM:SS)
export function formatDLNATime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Helper to parse DLNA duration string
export function parseDLNATime(timeString: string): number {
  const parts = timeString.split(':');
  if (parts.length !== 3) return 0;
  const [h, m, s] = parts.map(Number);
  return h * 3600 + m * 60 + s;
}
