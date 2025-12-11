import { useState, useEffect } from 'react';

interface NetworkInfo {
  isOnline: boolean;
  isWifi: boolean;
  connectionType: string;
  effectiveType?: string;
}

const WIFI_ONLY_KEY = 'hoyeeh-wifi-only-downloads';

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

  useEffect(() => {
    const updateNetworkInfo = () => {
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

      setNetworkInfo({
        isOnline: navigator.onLine,
        isWifi,
        connectionType,
        effectiveType,
      });
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

    return () => {
      window.removeEventListener('online', updateNetworkInfo);
      window.removeEventListener('offline', updateNetworkInfo);
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo);
      }
    };
  }, []);

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

  return {
    ...networkInfo,
    wifiOnlyEnabled,
    toggleWifiOnly,
    canDownload,
    getDownloadBlockedReason,
  };
}
