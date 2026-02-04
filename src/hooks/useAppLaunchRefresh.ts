import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const LAST_REFRESH_KEY = 'hoyeeh_last_app_refresh';
const MIN_REFRESH_INTERVAL = 60 * 1000; // Minimum 1 minute between refreshes

/**
 * Hook to refresh app data on launch/resume.
 * Ensures the mobile PWA always fetches the latest content when:
 * 1. App is first launched
 * 2. App is resumed from background (visibility change)
 * 3. App regains network connectivity
 */
export function useAppLaunchRefresh() {
  const queryClient = useQueryClient();
  const isRefreshing = useRef(false);
  const lastRefreshTime = useRef<number>(0);

  const refreshAllData = useCallback(async (showToast = false) => {
    // Prevent concurrent refreshes
    if (isRefreshing.current) {
      console.log('[AppLaunchRefresh] Already refreshing, skipping...');
      return;
    }

    // Check minimum interval between refreshes
    const now = Date.now();
    if (now - lastRefreshTime.current < MIN_REFRESH_INTERVAL) {
      console.log('[AppLaunchRefresh] Too soon since last refresh, skipping...');
      return;
    }

    isRefreshing.current = true;
    lastRefreshTime.current = now;

    console.log('[AppLaunchRefresh] Refreshing all app data...');

    try {
      // Invalidate all critical queries
      await Promise.all([
        // Home sections and content
        queryClient.invalidateQueries({ queryKey: ['home-sections-display'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home-sections'] }),
        queryClient.invalidateQueries({ queryKey: ['section-content-display'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-section-content'] }),
        queryClient.invalidateQueries({ queryKey: ['content'] }),
        
        // Trending and new releases
        queryClient.invalidateQueries({ queryKey: ['mobile-trending'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-new-releases'] }),
        queryClient.invalidateQueries({ queryKey: ['trending-content'] }),
        queryClient.invalidateQueries({ queryKey: ['recently-added-home'] }),
        
        // Top 10
        queryClient.invalidateQueries({ queryKey: ['mobile-top-10'] }),
        queryClient.invalidateQueries({ queryKey: ['top-10-display'] }),
        
        // Other sections
        queryClient.invalidateQueries({ queryKey: ['leaving-soon-content'] }),
        queryClient.invalidateQueries({ queryKey: ['hero-banners'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-hero-banners'] }),
        
        // User-specific data
        queryClient.invalidateQueries({ queryKey: ['continue-watching'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-continue-watching'] }),
        queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
      ]);

      // Store refresh time
      try {
        localStorage.setItem(LAST_REFRESH_KEY, now.toString());
      } catch {}

      if (showToast) {
        toast.success('Content updated', { duration: 1500 });
      }

      console.log('[AppLaunchRefresh] Refresh complete');
    } catch (error) {
      console.error('[AppLaunchRefresh] Error refreshing data:', error);
    } finally {
      isRefreshing.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    // Load last refresh time from storage
    try {
      const stored = localStorage.getItem(LAST_REFRESH_KEY);
      if (stored) {
        lastRefreshTime.current = parseInt(stored, 10);
      }
    } catch {}

    // Initial refresh on app launch
    console.log('[AppLaunchRefresh] App launched, triggering initial refresh...');
    refreshAllData();

    // Handle visibility change (app resume from background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[AppLaunchRefresh] App resumed from background');
        refreshAllData();
      }
    };

    // Handle online/offline events
    const handleOnline = () => {
      console.log('[AppLaunchRefresh] Network connection restored');
      // Wait a moment for connection to stabilize
      setTimeout(() => refreshAllData(true), 1000);
    };

    // Handle page focus (for when app is brought to foreground)
    const handleFocus = () => {
      console.log('[AppLaunchRefresh] App gained focus');
      refreshAllData();
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);

    // PWA-specific: Listen for app activation
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Check for updates when app becomes visible
        const checkForUpdates = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        };
        document.addEventListener('visibilitychange', checkForUpdates);
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshAllData]);

  return { refreshAllData };
}
