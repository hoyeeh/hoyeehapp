import { useState, useEffect, useRef } from 'react';

export interface NetworkQuality {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
  recommendedQuality: '1080' | '720' | '480' | '360' | 'auto';
  connectionType: string;
  isOnline: boolean;
}

interface NetworkInformation extends EventTarget {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;
  rtt: number;
  saveData: boolean;
  type?: string;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

function getRecommendedQuality(downlink: number, effectiveType: string): NetworkQuality['recommendedQuality'] {
  if (downlink >= 10) return '1080';
  if (downlink >= 5) return '720';
  if (downlink >= 2) return '480';
  if (downlink >= 0.5) return '360';

  switch (effectiveType) {
    case '4g':
      return '720';
    case '3g':
      return '480';
    case '2g':
    case 'slow-2g':
      return '360';
    default:
      return 'auto';
  }
}

function getNetworkState(): NetworkQuality {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  if (connection) {
    const recommended = getRecommendedQuality(connection.downlink || 10, connection.effectiveType || '4g');
    return {
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 10,
      rtt: connection.rtt || 50,
      saveData: connection.saveData || false,
      recommendedQuality: connection.saveData ? '480' : recommended,
      connectionType: connection.type || 'unknown',
      isOnline: navigator.onLine,
    };
  }

  return {
    effectiveType: 'unknown',
    downlink: 10,
    rtt: 50,
    saveData: false,
    recommendedQuality: 'auto',
    connectionType: 'unknown',
    isOnline: navigator.onLine,
  };
}

export function useNetworkQuality(): NetworkQuality {
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>(getNetworkState);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    const handleChange = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        const newState = getNetworkState();
        setNetworkQuality(prev => {
          if (
            prev.effectiveType === newState.effectiveType &&
            prev.downlink === newState.downlink &&
            prev.rtt === newState.rtt &&
            prev.saveData === newState.saveData &&
            prev.isOnline === newState.isOnline
          ) {
            return prev;
          }
          return newState;
        });
      }, 100);
    };
    
    if (connection) {
      connection.addEventListener('change', handleChange);
    }
    
    window.addEventListener('online', handleChange);
    window.addEventListener('offline', handleChange);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (connection) {
        connection.removeEventListener('change', handleChange);
      }
      window.removeEventListener('online', handleChange);
      window.removeEventListener('offline', handleChange);
    };
  }, []);

  return networkQuality;
}

// Hook for adaptive video quality that changes based on network
export function useAdaptiveQuality(isHls: boolean) {
  const network = useNetworkQuality();
  const [autoQuality, setAutoQuality] = useState<string>('auto');
  const [isAdaptive, setIsAdaptive] = useState(true);

  useEffect(() => {
    if (!isAdaptive || !isHls) return;

    // Update quality recommendation when network changes
    if (network.recommendedQuality !== 'auto') {
      setAutoQuality(network.recommendedQuality);
    }
  }, [network.recommendedQuality, isAdaptive, isHls]);

  const getQualityLabel = () => {
    if (!isAdaptive) return 'Manual';
    
    switch (network.effectiveType) {
      case '4g':
        return 'HD (Fast connection)';
      case '3g':
        return 'SD (Moderate connection)';
      case '2g':
      case 'slow-2g':
        return 'Low (Slow connection)';
      default:
        return 'Auto';
    }
  };

  return {
    network,
    autoQuality,
    isAdaptive,
    setIsAdaptive,
    getQualityLabel,
    setManualQuality: (quality: string) => {
      setIsAdaptive(false);
      setAutoQuality(quality);
    },
    enableAdaptive: () => setIsAdaptive(true),
  };
}
