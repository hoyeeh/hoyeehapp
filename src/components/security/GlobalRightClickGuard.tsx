import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * GlobalRightClickGuard - Prevents right-click context menu on desktop browsers
 * 
 * This component blocks the browser context menu across the entire application
 * on desktop devices to prevent easy access to DevTools via right-click.
 * Mobile devices are excluded as right-click is not a security concern there.
 * 
 * Works alongside SecureVideoWrapper without modifying any video player components.
 */
export function GlobalRightClickGuard() {
  const isMobile = useIsMobile();

  useEffect(() => {
    // Skip on mobile devices - right-click protection not needed
    if (isMobile) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Use capture phase to intercept before any other handlers
    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [isMobile]);

  return null;
}
