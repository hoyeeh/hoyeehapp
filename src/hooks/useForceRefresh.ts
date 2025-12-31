import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { clearServiceWorkerCaches, forceServiceWorkerUpdate } from '@/utils/cacheManager';

interface ForceRefreshState {
  isRefreshing: boolean;
  lastRefresh: Date | null;
}

export function useForceRefresh() {
  const [state, setState] = useState<ForceRefreshState>({
    isRefreshing: false,
    lastRefresh: null,
  });

  const forceRefresh = useCallback(async (options?: { silent?: boolean }) => {
    if (state.isRefreshing) return;

    setState(prev => ({ ...prev, isRefreshing: true }));

    try {
      // Step 1: Clear service worker caches
      const cachesCleared = await clearServiceWorkerCaches();
      console.log(`Cleared ${cachesCleared} SW caches`);

      // Step 2: Force service worker update
      const swUpdated = await forceServiceWorkerUpdate();
      console.log('SW update triggered:', swUpdated);

      // Step 3: Clear browser cache for this origin
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => {
            if (!name.includes('download')) {
              return caches.delete(name);
            }
          })
        );
      }

      // Step 4: Unregister and re-register service worker for a clean slate
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          // Tell waiting SW to activate
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          // Trigger update check
          await registration.update();
        }
      }

      setState({
        isRefreshing: false,
        lastRefresh: new Date(),
      });

      if (!options?.silent) {
        toast.success('App refreshed successfully!');
      }

      // Reload the page with cache bypass
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (error) {
      console.error('Force refresh error:', error);
      setState(prev => ({ ...prev, isRefreshing: false }));
      
      if (!options?.silent) {
        toast.error('Failed to refresh app');
      }
    }
  }, [state.isRefreshing]);

  const clearAndReload = useCallback(async () => {
    // Nuclear option: clear everything and reload
    try {
      // Clear localStorage except auth
      const authToken = localStorage.getItem('sb-astugmzoxhxcyipxsojl-auth-token');
      const deviceKey = localStorage.getItem('hoyeeh-device-key');
      
      localStorage.clear();
      
      if (authToken) localStorage.setItem('sb-astugmzoxhxcyipxsojl-auth-token', authToken);
      if (deviceKey) localStorage.setItem('hoyeeh-device-key', deviceKey);
      
      sessionStorage.clear();

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }

      toast.success('Cache cleared! Reloading...');
      
      setTimeout(() => {
        window.location.href = window.location.origin + '?cache_bust=' + Date.now();
      }, 500);

    } catch (error) {
      console.error('Clear and reload error:', error);
      toast.error('Failed to clear cache');
    }
  }, []);

  return {
    ...state,
    forceRefresh,
    clearAndReload,
  };
}
