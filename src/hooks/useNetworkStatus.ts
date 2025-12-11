import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface NetworkInfo {
  isOnline: boolean;
  isWifi: boolean;
  connectionType: string;
  effectiveType?: string;
}

const WIFI_ONLY_KEY = 'hoyeeh-wifi-only-downloads';
const PAUSED_BY_NETWORK_KEY = 'hoyeeh-paused-by-network';

export function useNetworkStatus() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    isOnline: navigator.onLine,
    isWifi: true, // Default to true
    connectionType: 'unknown',
  });

  const [wifiOnlyEnabled, setWifiOnlyEnabled] = useState(() => {
    const stored = localStorage.getItem(WIFI_ONLY_KEY);
    return stored === 'true';
  });

  const previousWifiStatus = useRef<boolean>(true);
  const onNetworkChangeCallbacks = useRef<Set<(isWifi: boolean) => void>>(new Set());

  const checkNetworkType = useCallback(() => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    let isWifi = true;
    let connectionType = 'unknown';
    let effectiveType: string | undefined;

    if (connection) {
      connectionType = connection.type || 'unknown';
      effectiveType = connection.effectiveType;
      
      // Types that indicate mobile data
      const mobileTypes = ['cellular', '2g', '3g', '4g', '5g'];
      isWifi = !mobileTypes.includes(connectionType) && 
               !mobileTypes.includes(effectiveType || '');
      
      // If type is 'wifi' or 'ethernet', it's definitely not mobile data
      if (connectionType === 'wifi' || connectionType === 'ethernet') {
        isWifi = true;
      }
    }

    return { isWifi, connectionType, effectiveType };
  }, []);

  useEffect(() => {
    const updateNetworkInfo = () => {
      const { isWifi, connectionType, effectiveType } = checkNetworkType();
      const isOnline = navigator.onLine;

      setNetworkInfo({
        isOnline,
        isWifi,
        connectionType,
        effectiveType,
      });

      // Detect Wi-Fi to mobile data switch (or vice versa)
      if (previousWifiStatus.current !== isWifi && wifiOnlyEnabled) {
        if (!isWifi && previousWifiStatus.current) {
          // Switched from Wi-Fi to mobile data
          toast.warning('Switched to mobile data. Downloads paused.');
          // Notify all registered callbacks
          onNetworkChangeCallbacks.current.forEach(cb => cb(false));
        } else if (isWifi && !previousWifiStatus.current) {
          // Switched back to Wi-Fi
          toast.success('Connected to Wi-Fi. Downloads resuming...');
          // Notify all registered callbacks
          onNetworkChangeCallbacks.current.forEach(cb => cb(true));
        }
      }

      previousWifiStatus.current = isWifi;
    };

    updateNetworkInfo();

    // Listen for online/offline events
    window.addEventListener('online', updateNetworkInfo);
    window.addEventListener('offline', updateNetworkInfo);

    // Listen for connection changes if supported
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
    }

    // Poll every 5 seconds as fallback for connection changes
    const pollInterval = setInterval(updateNetworkInfo, 5000);

    return () => {
      window.removeEventListener('online', updateNetworkInfo);
      window.removeEventListener('offline', updateNetworkInfo);
      clearInterval(pollInterval);
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo);
      }
    };
  }, [checkNetworkType, wifiOnlyEnabled]);

  const toggleWifiOnly = (enabled: boolean) => {
    setWifiOnlyEnabled(enabled);
    localStorage.setItem(WIFI_ONLY_KEY, String(enabled));
  };

  const canDownload = () => {
    if (!networkInfo.isOnline) return false;
    if (wifiOnlyEnabled && !networkInfo.isWifi) return false;
    return true;
  };

  const getDownloadBlockedReason = (): string | null => {
    if (!networkInfo.isOnline) return 'No internet connection';
    if (wifiOnlyEnabled && !networkInfo.isWifi) return 'Wi-Fi only mode is enabled. Connect to Wi-Fi to download.';
    return null;
  };

  // Register callback for network changes
  const onNetworkChange = useCallback((callback: (isWifi: boolean) => void) => {
    onNetworkChangeCallbacks.current.add(callback);
    return () => {
      onNetworkChangeCallbacks.current.delete(callback);
    };
  }, []);

  // Track downloads paused by network change
  const markPausedByNetwork = useCallback((downloadIds: string[]) => {
    localStorage.setItem(PAUSED_BY_NETWORK_KEY, JSON.stringify(downloadIds));
  }, []);

  const getPausedByNetwork = useCallback((): string[] => {
    const stored = localStorage.getItem(PAUSED_BY_NETWORK_KEY);
    return stored ? JSON.parse(stored) : [];
  }, []);

  const clearPausedByNetwork = useCallback(() => {
    localStorage.removeItem(PAUSED_BY_NETWORK_KEY);
  }, []);

  return {
    ...networkInfo,
    wifiOnlyEnabled,
    toggleWifiOnly,
    canDownload,
    getDownloadBlockedReason,
    onNetworkChange,
    markPausedByNetwork,
    getPausedByNetwork,
    clearPausedByNetwork,
  };
}
