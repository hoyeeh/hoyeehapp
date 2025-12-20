import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';

interface PWAUpdateState {
  updateAvailable: boolean;
  updateReady: boolean;
  registration: ServiceWorkerRegistration | null;
}

export function usePWAUpdates() {
  const [state, setState] = useState<PWAUpdateState>({
    updateAvailable: false,
    updateReady: false,
    registration: null,
  });

  const applyUpdate = useCallback(() => {
    if (state.registration?.waiting) {
      // Tell the waiting service worker to skip waiting
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [state.registration]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      // New service worker has taken control, reload the page
      window.location.reload();
    };

    const handleUpdateFound = (registration: ServiceWorkerRegistration) => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New update is ready to be applied
          setState(prev => ({ ...prev, updateAvailable: true, updateReady: true }));
          
          // Auto-apply update after a short delay
          toast.info('Updating app...', { duration: 2000 });
          setTimeout(() => {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }, 1500);
        }
      });
    };

    // Listen for controller changes (when new SW takes over)
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check for updates on the existing registration
    navigator.serviceWorker.ready.then((registration) => {
      setState(prev => ({ ...prev, registration }));

      // Check if there's already an update waiting
      if (registration.waiting) {
        setState(prev => ({ ...prev, updateAvailable: true, updateReady: true }));
        // Auto-apply waiting update
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Listen for new updates
      registration.addEventListener('updatefound', () => handleUpdateFound(registration));

      // Check for updates periodically (every 30 seconds for PWA)
      const checkInterval = setInterval(() => {
        registration.update().catch(() => {
          // Silently fail on update check errors
        });
      }, 30000);

      return () => clearInterval(checkInterval);
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return {
    ...state,
    applyUpdate,
  };
}
