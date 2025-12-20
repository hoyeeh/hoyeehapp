import { useState, useEffect } from 'react';

interface OfflineStatus {
  isOffline: boolean;
  wasOffline: boolean;
  connectionType: string | null;
}

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>({
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    wasOffline: false,
    connectionType: null,
  });

  useEffect(() => {
    // Get connection type if available
    const getConnectionType = (): string | null => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      return connection?.effectiveType || null;
    };

    const handleOnline = () => {
      setStatus(prev => ({
        isOffline: false,
        wasOffline: prev.isOffline, // Track if we were previously offline
        connectionType: getConnectionType(),
      }));
    };

    const handleOffline = () => {
      setStatus(prev => ({
        ...prev,
        isOffline: true,
        connectionType: null,
      }));
    };

    const handleConnectionChange = () => {
      setStatus(prev => ({
        ...prev,
        connectionType: getConnectionType(),
      }));
    };

    // Set initial state
    setStatus({
      isOffline: !navigator.onLine,
      wasOffline: false,
      connectionType: getConnectionType(),
    });

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  return status;
}
