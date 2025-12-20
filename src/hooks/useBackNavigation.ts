import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseBackNavigationOptions {
  fallbackPath?: string;
  onBack?: () => void;
}

/**
 * A hook for consistent back navigation across the app.
 * Handles browser history, physical device back button (Capacitor), and fallback navigation.
 */
export function useBackNavigation(options: UseBackNavigationOptions = {}) {
  const { fallbackPath = '/', onBack } = options;
  const navigate = useNavigate();

  const goBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  }, [navigate, fallbackPath, onBack]);

  // Listen for Capacitor back button events (for native apps)
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupCapacitorBackButton = async () => {
      try {
        // Dynamically import Capacitor App plugin only if available
        const { App } = await import('@capacitor/app');
        
        const listener = App.addListener('backButton', ({ canGoBack }) => {
          if (onBack) {
            onBack();
          } else if (canGoBack) {
            window.history.back();
          } else {
            navigate(fallbackPath);
          }
        });

        cleanup = () => {
          listener.then(l => l.remove());
        };
      } catch (e) {
        // Capacitor not available (web environment), use browser popstate
        const handlePopstate = () => {
          // Browser handles this automatically, but we can hook into it if needed
        };
        
        window.addEventListener('popstate', handlePopstate);
        cleanup = () => window.removeEventListener('popstate', handlePopstate);
      }
    };

    setupCapacitorBackButton();

    return () => {
      cleanup?.();
    };
  }, [navigate, fallbackPath, onBack]);

  return { goBack };
}
