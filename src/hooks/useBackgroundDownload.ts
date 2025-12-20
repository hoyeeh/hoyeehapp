import { useEffect, useCallback, useRef, useState } from 'react';
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
  isBackgroundFetch?: boolean;
}

const BACKGROUND_STATE_KEY = 'hoyeeh-background-downloads';

export function useBackgroundDownload() {
  const isBackgroundRef = useRef(false);
  const activeDownloadsRef = useRef<Map<string, BackgroundDownloadState>>(new Map());
  const [pendingDownloads, setPendingDownloads] = useState<BackgroundDownloadState[]>([]);

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
    
    // Try to register with service worker for true background downloads
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'START_BACKGROUND_DOWNLOAD',
        payload: {
          downloadId: state.downloadId,
          title: state.title,
          url: '', // Will be set when actual download starts
        }
      });
    }
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
    
    // Also cancel in service worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CANCEL_BACKGROUND_DOWNLOAD',
        payload: { downloadId }
      });
    }
  }, [saveBackgroundState]);

  // Get pending background downloads that need to be resumed
  const getPendingBackgroundDownloads = useCallback((): BackgroundDownloadState[] => {
    return Array.from(activeDownloadsRef.current.values())
      .filter(d => d.status === 'downloading' || d.status === 'paused');
  }, []);

  // Listen for service worker messages
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      
      switch (type) {
        case 'BACKGROUND_DOWNLOAD_COMPLETE':
          const completeState = activeDownloadsRef.current.get(payload.downloadId);
          if (completeState) {
            activeDownloadsRef.current.set(payload.downloadId, {
              ...completeState,
              status: 'completed',
              progress: 100,
            });
            saveBackgroundState();
            toast.success(`Download complete: ${completeState.title}`);
          }
          break;
          
        case 'BACKGROUND_DOWNLOAD_FAILED':
          const failedState = activeDownloadsRef.current.get(payload.downloadId);
          if (failedState) {
            activeDownloadsRef.current.set(payload.downloadId, {
              ...failedState,
              status: 'failed',
            });
            saveBackgroundState();
            toast.error(`Download failed: ${failedState.title}`);
          }
          break;
          
        case 'BACKGROUND_DOWNLOAD_FALLBACK':
          toast.info(payload.message, { duration: 5000 });
          break;
          
        case 'DOWNLOAD_READY_TO_RESUME':
          const resumeState = activeDownloadsRef.current.get(payload.downloadId);
          if (resumeState) {
            toast.info(`Ready to resume: ${resumeState.title}`, {
              action: {
                label: 'Resume',
                onClick: () => {
                  // Trigger resume
                  window.dispatchEvent(new CustomEvent('resume-download', { 
                    detail: { downloadId: payload.downloadId } 
                  }));
                }
              }
            });
          }
          break;
          
        case 'RETRY_DOWNLOAD':
          window.dispatchEvent(new CustomEvent('retry-download', { 
            detail: { downloadId: payload.downloadId } 
          }));
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [saveBackgroundState]);

  // Handle visibility change for background/foreground transitions
  useEffect(() => {
    // Load saved state on mount
    activeDownloadsRef.current = loadBackgroundState();
    setPendingDownloads(getPendingBackgroundDownloads());

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App going to background
        isBackgroundRef.current = true;
        saveBackgroundState();
        
        // Register background sync for paused downloads
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready.then(registration => {
            const pending = getPendingBackgroundDownloads();
            pending.forEach(download => {
              if (download.status === 'paused') {
                (registration as any).sync?.register(`sync-download-${download.downloadId}`);
              }
            });
          });
        }
        
        // Show notification if downloads are in progress
        const inProgress = getPendingBackgroundDownloads().filter(d => d.status === 'downloading');
        if (inProgress.length > 0 && isBackgroundFetchSupported()) {
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
        
        setPendingDownloads(getPendingBackgroundDownloads());
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
      const pending = getPendingBackgroundDownloads();
      if (pending.length > 0) {
        console.log('Back online in background, downloads can resume');
        
        // Request background sync
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready.then(registration => {
            pending.forEach(download => {
              (registration as any).sync?.register(`sync-download-${download.downloadId}`);
            });
          });
        }
      }
    };

    const handleOffline = () => {
      if (!document.hidden) return;
      
      // App is in background and went offline - pause downloads
      activeDownloadsRef.current.forEach((download, id) => {
        if (download.status === 'downloading') {
          activeDownloadsRef.current.set(id, { ...download, status: 'paused' });
          
          // Notify service worker
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'PAUSE_BACKGROUND_DOWNLOAD',
              payload: { downloadId: id }
            });
          }
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

  // Start a true background download using Background Fetch API
  const startBackgroundFetch = useCallback(async (
    downloadId: string,
    url: string,
    title: string,
    headers?: Record<string, string>
  ): Promise<boolean> => {
    if (!isBackgroundFetchSupported()) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if ('backgroundFetch' in registration) {
        const bgFetch = await (registration as any).backgroundFetch.fetch(
          downloadId,
          [new Request(url, { headers })],
          {
            title: `Downloading: ${title}`,
            icons: [{ src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png' }],
            downloadTotal: 0,
          }
        );

        bgFetch.addEventListener('progress', () => {
          const progress = bgFetch.downloadTotal > 0 
            ? Math.round((bgFetch.downloaded / bgFetch.downloadTotal) * 100)
            : 0;
          updateBackgroundProgress(downloadId, progress, bgFetch.downloaded);
        });

        // Mark as background fetch
        const state = activeDownloadsRef.current.get(downloadId);
        if (state) {
          activeDownloadsRef.current.set(downloadId, { ...state, isBackgroundFetch: true });
          saveBackgroundState();
        }

        return true;
      }
    } catch (error) {
      console.error('Background Fetch failed:', error);
    }

    return false;
  }, [updateBackgroundProgress, saveBackgroundState]);

  return {
    registerBackgroundDownload,
    updateBackgroundProgress,
    removeBackgroundDownload,
    getPendingBackgroundDownloads,
    isInBackground,
    loadBackgroundState,
    startBackgroundFetch,
    pendingDownloads,
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
  title: string,
  headers?: Record<string, string>
): Promise<boolean> {
  if (!isBackgroundFetchSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    if ('backgroundFetch' in registration) {
      const bgFetch = await (registration as any).backgroundFetch.fetch(
        downloadId,
        [new Request(url, { headers })],
        {
          title: `Downloading: ${title}`,
          icons: [{ src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png' }],
          downloadTotal: 0,
        }
      );

      bgFetch.addEventListener('progress', () => {
        const progress = bgFetch.downloadTotal > 0 
          ? Math.round((bgFetch.downloaded / bgFetch.downloadTotal) * 100)
          : 0;
        console.log(`Background download progress: ${progress}%`);
      });

      return true;
    }
  } catch (error) {
    console.error('Background Fetch failed:', error);
  }

  return false;
}
