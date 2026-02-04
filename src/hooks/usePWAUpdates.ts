import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';

interface PWAUpdateState {
  updateAvailable: boolean;
  updateReady: boolean;
  registration: ServiceWorkerRegistration | null;
}

// Clear all service worker caches
async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[PWAUpdates] Clearing cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
      console.log('[PWAUpdates] All caches cleared');
    } catch (error) {
      console.error('[PWAUpdates] Error clearing caches:', error);
    }
  }
}

export function usePWAUpdates() {
  const [state, setState] = useState<PWAUpdateState>({
    updateAvailable: false,
    updateReady: false,
    registration: null,
  });

  const applyUpdate = useCallback(async () => {
    if (state.registration?.waiting) {
      // Clear caches before applying update
      await clearAllCaches();
      // Tell the waiting service worker to skip waiting
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [state.registration]);

  // Force check for updates
  const checkForUpdates = useCallback(async () => {
    if (state.registration) {
      try {
        await state.registration.update();
        console.log('[PWAUpdates] Update check complete');
      } catch (error) {
        console.error('[PWAUpdates] Update check failed:', error);
      }
    }
  }, [state.registration]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = async () => {
      // Clear caches when new service worker takes control
      await clearAllCaches();
      // Reload the page to get fresh content
      window.location.reload();
    };

    const handleUpdateFound = (registration: ServiceWorkerRegistration) => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', async () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New update is ready to be applied
          setState(prev => ({ ...prev, updateAvailable: true, updateReady: true }));
          
          console.log('[PWAUpdates] New version ready, applying update...');
          toast.info('Updating app...', { duration: 2000 });
          
          // Clear caches and auto-apply update
          await clearAllCaches();
          setTimeout(() => {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }, 1000);
        }
      });
    };

    // Listen for controller changes (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check for updates on the existing registration
    navigator.serviceWorker.ready.then(async (registration) => {
      setState(prev => ({ ...prev, registration }));

      // Check if there's already an update waiting
      if (registration.waiting) {
        console.log('[PWAUpdates] Update waiting, applying...');
        setState(prev => ({ ...prev, updateAvailable: true, updateReady: true }));
        // Clear caches and apply waiting update
        await clearAllCaches();
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Listen for new updates
      registration.addEventListener('updatefound', () => handleUpdateFound(registration));

      // Check for updates periodically (every 15 seconds for faster updates)
      const checkInterval = setInterval(() => {
        registration.update().catch(() => {
          // Silently fail on update check errors
        });
      }, 15000);

      // Also check on visibility change (when app becomes visible)
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        clearInterval(checkInterval);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return {
    ...state,
    applyUpdate,
    checkForUpdates,
    clearAllCaches,
  };
}
