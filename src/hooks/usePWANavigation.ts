import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook to manage PWA navigation and prevent users from accidentally exiting the app
 * When running as a standalone PWA, this ensures:
 * 1. Back button always returns to home instead of exiting
 * 2. History is managed to keep users within the app
 */
export function usePWANavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  // Check if running as standalone PWA
  const isStandalonePWA = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://') ||
      window.location.search.includes('pwa=true')
    );
  }, []);

  // Navigate to home safely
  const goHome = useCallback(() => {
    if (location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (!isStandalonePWA()) return;

    // Add an initial history entry when the app loads
    // This prevents the back button from exiting the app immediately
    const initializeHistory = () => {
      if (window.history.length <= 1) {
        window.history.pushState({ pwa: true, initial: true }, '', window.location.href);
      }
    };

    // Handle the popstate event (back button press)
    const handlePopState = (event: PopStateEvent) => {
      // If we're at the home page or have no more history, prevent exit
      if (location.pathname === '/' || window.history.length <= 1) {
        // Push state back to prevent exiting
        window.history.pushState({ pwa: true }, '', window.location.href);
        return;
      }
      
      // If the state indicates this is a PWA navigation, let it proceed
      if (event.state?.pwa) {
        return;
      }
    };

    initializeHistory();
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isStandalonePWA, location.pathname]);

  // Push state whenever we navigate to ensure back button works properly
  useEffect(() => {
    if (!isStandalonePWA()) return;
    
    // Mark each navigation with PWA state
    if (!window.history.state?.pwa) {
      window.history.replaceState({ pwa: true, path: location.pathname }, '', window.location.href);
    }
  }, [location.pathname, isStandalonePWA]);

  return {
    isStandalonePWA: isStandalonePWA(),
    goHome,
  };
}
