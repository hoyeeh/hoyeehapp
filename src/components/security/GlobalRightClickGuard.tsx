import { useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

/**
 * GlobalRightClickGuard - Prevents right-click context menu on desktop browsers
 * 
 * This component blocks the browser context menu across the entire application
 * on desktop devices to prevent easy access to DevTools via right-click.
 * Mobile devices are excluded as right-click is not a security concern there.
 * Shows a subtle toast notification when blocked (rate limited).
 * 
 * Works alongside SecureVideoWrapper without modifying any video player components.
 */
export function GlobalRightClickGuard() {
  const isMobile = useIsMobile();
  const lastToastTime = useRef<number>(0);
  const TOAST_RATE_LIMIT_MS = 3000; // Only show toast once every 3 seconds

  useEffect(() => {
    // Skip on mobile devices - right-click protection not needed
    if (isMobile) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Rate-limited toast notification
      const now = Date.now();
      if (now - lastToastTime.current >= TOAST_RATE_LIMIT_MS) {
        lastToastTime.current = now;
        toast.info("Right-click is disabled for security", {
          duration: 2000,
          position: 'bottom-center',
        });
      }

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
