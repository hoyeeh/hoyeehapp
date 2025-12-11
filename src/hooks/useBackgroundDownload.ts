import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface BackgroundDownloadState {
  downloadId: string;
  contentId: string;
  episodeId?: string;
  title: string;
  progress: number;
  status: 'downloading' | 'paused' | 'completed' | 'failed';
  downloadedSize: number;
  totalSize: number;
  startedAt: number;
}

const BACKGROUND_STATE_KEY = 'hoyeeh-background-downloads';

export function useBackgroundDownload() {
  const isBackgroundRef = useRef(false);
  const activeDownloadsRef = useRef<Map<string, BackgroundDownloadState>>(new Map());

  // Save state to localStorage for persistence
  const saveBackgroundState = useCallback(() => {
    const state = Array.from(activeDownloadsRef.current.entries());
    localStorage.setItem(BACKGROUND_STATE_KEY, JSON.stringify(state));
  }, []);

  // Load state from localStorage
  const loadBackgroundState = useCallback((): Map<string, BackgroundDownloadState> => {
    try {
      const saved = localStorage.getItem(BACKGROUND_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Map(parsed);
      }
    } catch (e) {
      console.error('Failed to load background download state:', e);
    }
    return new Map();
  }, []);

  // Register a download for background continuation
  const registerBackgroundDownload = useCallback((state: BackgroundDownloadState) => {
    activeDownloadsRef.current.set(state.downloadId, state);
    saveBackgroundState();
  }, [saveBackgroundState]);

  // Update download progress
  const updateBackgroundProgress = useCallback((
    downloadId: string, 
    progress: number, 
    downloadedSize: number,
    status?: BackgroundDownloadState['status']
  ) => {
    const current = activeDownloadsRef.current.get(downloadId);
    if (current) {
      activeDownloadsRef.current.set(downloadId, {
        ...current,
        progress,
        downloadedSize,
        status: status || current.status,
      });
      saveBackgroundState();
    }
  }, [saveBackgroundState]);

  // Remove completed/cancelled download from background tracking
  const removeBackgroundDownload = useCallback((downloadId: string) => {
    activeDownloadsRef.current.delete(downloadId);
    saveBackgroundState();
  }, [saveBackgroundState]);

  // Get pending background downloads that need to be resumed
  const getPendingBackgroundDownloads = useCallback((): BackgroundDownloadState[] => {
    return Array.from(activeDownloadsRef.current.values())
      .filter(d => d.status === 'downloading' || d.status === 'paused');
  }, []);

  // Handle visibility change for background/foreground transitions
  useEffect(() => {
    // Load saved state on mount
    activeDownloadsRef.current = loadBackgroundState();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App going to background
        isBackgroundRef.current = true;
        saveBackgroundState();
        
        // Try to use Background Fetch API if available
        if ('serviceWorker' in navigator && 'BackgroundFetchManager' in window) {
          // Background Fetch is available - service worker will handle it
          console.log('Background Fetch available, downloads will continue');
        }
      } else {
        // App coming to foreground
        isBackgroundRef.current = false;
        
        // Check for any downloads that completed in background
        const savedState = loadBackgroundState();
        const completedInBackground = Array.from(savedState.values())
          .filter(d => d.status === 'completed');
        
        if (completedInBackground.length > 0) {
          toast.success(`${completedInBackground.length} download(s) completed in background`);
          completedInBackground.forEach(d => {
            activeDownloadsRef.current.delete(d.downloadId);
          });
          saveBackgroundState();
        }
        
        // Notify about paused downloads that need attention
        const pausedDownloads = Array.from(savedState.values())
          .filter(d => d.status === 'paused');
        
        if (pausedDownloads.length > 0) {
          toast.info(`${pausedDownloads.length} download(s) paused - tap to resume`);
        }
      }
    };

    // Handle page unload - save state
    const handleBeforeUnload = () => {
      saveBackgroundState();
    };

    // Handle online/offline for background downloads
    const handleOnline = () => {
      if (!document.hidden) return;
      
      // App is in background and came back online
      const pendingDownloads = getPendingBackgroundDownloads();
      if (pendingDownloads.length > 0) {
        console.log('Back online in background, downloads can resume');
      }
    };

    const handleOffline = () => {
      if (!document.hidden) return;
      
      // App is in background and went offline - pause downloads
      activeDownloadsRef.current.forEach((download, id) => {
        if (download.status === 'downloading') {
          activeDownloadsRef.current.set(id, { ...download, status: 'paused' });
        }
      });
      saveBackgroundState();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadBackgroundState, saveBackgroundState, getPendingBackgroundDownloads]);

  // Check if running in background
  const isInBackground = useCallback(() => {
    return document.hidden || isBackgroundRef.current;
  }, []);

  return {
    registerBackgroundDownload,
    updateBackgroundProgress,
    removeBackgroundDownload,
    getPendingBackgroundDownloads,
    isInBackground,
    loadBackgroundState,
  };
}

// Utility to check if Background Fetch API is supported
export function isBackgroundFetchSupported(): boolean {
  return 'serviceWorker' in navigator && 'BackgroundFetchManager' in window;
}

// Utility to request background download permission via service worker
export async function requestBackgroundDownload(
  downloadId: string,
  url: string,
  title: string
): Promise<boolean> {
  if (!isBackgroundFetchSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if BackgroundFetchManager exists
    if ('backgroundFetch' in registration) {
      const bgFetch = await (registration as any).backgroundFetch.fetch(
        downloadId,
        [url],
        {
          title: `Downloading: ${title}`,
          icons: [{ src: '/favicon.png', sizes: '192x192', type: 'image/png' }],
          downloadTotal: 0, // Unknown size
        }
      );

      bgFetch.addEventListener('progress', () => {
        const progress = bgFetch.downloaded / bgFetch.downloadTotal * 100;
        console.log(`Background download progress: ${progress.toFixed(1)}%`);
      });

      return true;
    }
  } catch (error) {
    console.error('Background Fetch failed:', error);
  }

  return false;
}
