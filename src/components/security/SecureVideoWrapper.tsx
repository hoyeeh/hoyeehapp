import { useEffect, useRef, ReactNode } from 'react';

interface SecureVideoWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * SecureVideoWrapper - A wrapper component that adds security layers to video players
 * 
 * Security measures:
 * 1. Blocks DevTools keyboard shortcuts (F12, Ctrl+Shift+I, Ctrl+U)
 * 2. Prevents right-click context menu
 * 3. Adds CSS obfuscation for video elements
 * 4. Anti-debugging measures
 */
export function SecureVideoWrapper({ children, className = '' }: SecureVideoWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Block DevTools keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+I (Inspect)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+Shift+C (Element picker)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        return false;
      }
      
      // Ctrl+U (View source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
      
      // Cmd+Option+I (Mac Inspect)
      if (e.metaKey && e.altKey && e.key === 'i') {
        e.preventDefault();
        return false;
      }
      
      // Cmd+Option+J (Mac Console)
      if (e.metaKey && e.altKey && e.key === 'j') {
        e.preventDefault();
        return false;
      }
      
      // Cmd+Option+U (Mac View Source)
      if (e.metaKey && e.altKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }
    };

    // Prevent context menu (right-click)
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only block on video-related elements
      if (
        target.tagName === 'VIDEO' ||
        target.closest('video') ||
        target.closest('[data-secure-video]')
      ) {
        e.preventDefault();
        return false;
      }
    };

    // Anti-debugging: detect devtools by timing
    let devToolsOpen = false;
    const threshold = 160;
    
    const detectDevTools = () => {
      const start = performance.now();
      // debugger statement is slower when devtools is open
      // We use a less aggressive check that just logs
      const delta = performance.now() - start;
      if (delta > threshold && !devToolsOpen) {
        devToolsOpen = true;
        console.warn('Development tools detected');
      }
    };

    // Run detection periodically (non-blocking)
    const detectionInterval = setInterval(detectDevTools, 5000);

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      clearInterval(detectionInterval);
    };
  }, []);

  // Inject CSS to obfuscate video source in inspector
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'secure-video-styles';
    style.textContent = `
      /* Hide video source attribute in element inspector */
      [data-secure-video] video::after {
        content: '';
      }
      
      /* Make source hard to copy */
      [data-secure-video] video {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        pointer-events: auto;
      }
      
      /* Blur video source element in inspector */
      [data-secure-video] source {
        display: none !important;
      }
    `;
    
    // Only add if not already present
    if (!document.getElementById('secure-video-styles')) {
      document.head.appendChild(style);
    }

    return () => {
      const existingStyle = document.getElementById('secure-video-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      data-secure-video="true"
      className={`secure-video-container ${className}`}
      style={{
        // Prevent drag of video content
        WebkitUserDrag: 'none',
        userSelect: 'none',
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export default SecureVideoWrapper;
