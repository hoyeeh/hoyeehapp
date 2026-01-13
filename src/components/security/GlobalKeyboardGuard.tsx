import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * GlobalKeyboardGuard - Blocks DevTools keyboard shortcuts on desktop browsers
 * 
 * This component prevents common keyboard shortcuts used to access browser DevTools:
 * - F12 (DevTools)
 * - Ctrl+Shift+I / Cmd+Option+I (Inspect Element)
 * - Ctrl+Shift+J / Cmd+Option+J (Console)
 * - Ctrl+Shift+C (Element Picker)
 * - Ctrl+U / Cmd+Option+U (View Source)
 * - Ctrl+S / Cmd+S (Save Page)
 * 
 * Works alongside SecureVideoWrapper and GlobalRightClickGuard.
 */
export function GlobalKeyboardGuard() {
  const isMobile = useIsMobile();

  useEffect(() => {
    // Skip on mobile devices - keyboard shortcuts not a concern
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (Mac) - Inspect Element
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Ctrl+Shift+J (Windows/Linux) or Cmd+Option+J (Mac) - Console
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Ctrl+Shift+C (Element Picker)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Ctrl+U (Windows/Linux) or Cmd+Option+U (Mac) - View Source
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block Ctrl+S (Windows/Linux) or Cmd+S (Mac) - Save Page
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Use capture phase to intercept before any other handlers
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isMobile]);

  return null;
}
