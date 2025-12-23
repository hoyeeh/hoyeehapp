import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface DiscoveredDevice {
  id: string;
  name: string;
  type: 'dlna' | 'chromecast' | 'airplay' | 'unknown';
  host: string;
  port: number;
  services: string[];
  lastSeen: number;
}

interface DiscoveryRelayState {
  isConnected: boolean;
  isScanning: boolean;
  devices: DiscoveredDevice[];
  relayUrl: string | null;
  error: string | null;
}

interface UseLocalDiscoveryRelayOptions {
  autoConnect?: boolean;
  onDevicesFound?: (devices: DiscoveredDevice[]) => void;
}

// Default relay server port (user runs discovery service locally)
const DEFAULT_RELAY_PORT = 9876;
const LOCAL_STORAGE_KEY = 'hoyeeh_discovery_relay_url';

/**
 * Hook for connecting to a local network discovery relay service.
 * 
 * The relay service is a lightweight app that runs on the user's computer
 * and performs SSDP/mDNS discovery, then exposes results via WebSocket.
 * 
 * This enables true device discovery that isn't possible in browsers.
 */
export function useLocalDiscoveryRelay(options: UseLocalDiscoveryRelayOptions = {}) {
  const { autoConnect = false, onDevicesFound } = options;

  const [state, setState] = useState<DiscoveryRelayState>({
    isConnected: false,
    isScanning: false,
    devices: [],
    relayUrl: null,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved relay URL
  useEffect(() => {
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedUrl) {
      setState(prev => ({ ...prev, relayUrl: savedUrl }));
      if (autoConnect) {
        connectToRelay(savedUrl);
      }
    }
  }, [autoConnect]);

  // Connect to relay WebSocket
  const connectToRelay = useCallback((url?: string) => {
    const relayUrl = url || state.relayUrl || `ws://localhost:${DEFAULT_RELAY_PORT}`;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(relayUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[DiscoveryRelay] Connected to relay');
        setState(prev => ({
          ...prev,
          isConnected: true,
          relayUrl,
          error: null,
        }));
        localStorage.setItem(LOCAL_STORAGE_KEY, relayUrl);
        
        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        toast.success('Connected to discovery relay');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleRelayMessage(message);
        } catch (error) {
          console.error('[DiscoveryRelay] Message parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[DiscoveryRelay] WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'Connection error',
        }));
      };

      ws.onclose = () => {
        console.log('[DiscoveryRelay] Disconnected from relay');
        setState(prev => ({
          ...prev,
          isConnected: false,
        }));

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        // Auto-reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (state.relayUrl) {
            connectToRelay(state.relayUrl);
          }
        }, 5000);
      };
    } catch (error) {
      console.error('[DiscoveryRelay] Connect error:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to connect to relay',
      }));
    }
  }, [state.relayUrl]);

  // Handle messages from relay
  const handleRelayMessage = useCallback((message: { type: string; devices?: DiscoveredDevice[]; error?: string }) => {
    switch (message.type) {
      case 'devices':
        if (message.devices) {
          setState(prev => ({
            ...prev,
            devices: message.devices!,
            isScanning: false,
          }));
          onDevicesFound?.(message.devices);
        }
        break;

      case 'scan_started':
        setState(prev => ({ ...prev, isScanning: true }));
        break;

      case 'scan_complete':
        setState(prev => ({ ...prev, isScanning: false }));
        break;

      case 'error':
        console.error('[DiscoveryRelay] Relay error:', message.error);
        setState(prev => ({ ...prev, error: message.error || 'Unknown error' }));
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('[DiscoveryRelay] Unknown message type:', message.type);
    }
  }, [onDevicesFound]);

  // Start device scan
  const scanForDevices = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to discovery relay');
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'scan',
      protocols: ['ssdp', 'mdns'],
      timeout: 10000,
    }));

    setState(prev => ({ ...prev, isScanning: true }));
  }, []);

  // Disconnect from relay
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      devices: [],
    }));
  }, []);

  // Set custom relay URL
  const setRelayUrl = useCallback((url: string) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, url);
    setState(prev => ({ ...prev, relayUrl: url }));
  }, []);

  // Clear saved relay URL
  const clearRelayUrl = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    disconnect();
    setState(prev => ({ ...prev, relayUrl: null }));
  }, [disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    connectToRelay,
    disconnect,
    scanForDevices,
    setRelayUrl,
    clearRelayUrl,
  };
}

/**
 * Instructions for setting up the discovery relay:
 * 
 * 1. Download the Hoyeeh Discovery Relay app for your platform
 * 2. Run the app - it will start a local WebSocket server on port 9876
 * 3. The app performs SSDP and mDNS discovery on your local network
 * 4. Connect to the relay from the Hoyeeh web app to see discovered devices
 * 
 * Alternatively, run the relay via Node.js:
 * 
 * ```
 * npx hoyeeh-discovery-relay
 * ```
 * 
 * The relay supports:
 * - DLNA/UPnP devices (Smart TVs, media servers)
 * - Chromecast devices
 * - AirPlay devices
 * - Other mDNS-advertised services
 */
