import { ReactNode, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

interface MobileSwipeWrapperProps {
  children: ReactNode;
  enableSwipeBack?: boolean;
  threshold?: number;
}

/**
 * Global wrapper for mobile pages that enables swipe-right-to-go-back gesture.
 * Provides visual feedback during the swipe gesture.
 */
export function MobileSwipeWrapper({ 
  children, 
  enableSwipeBack = true,
  threshold = 100 
}: MobileSwipeWrapperProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const edgeStartZone = 40; // Swipe must start from left edge

  // Don't enable swipe back on home page
  const isHomePage = location.pathname === '/';

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableSwipeBack || isHomePage) return;
    
    const touch = e.touches[0];
    // Only respond if touch starts from left edge
    if (touch.clientX <= edgeStartZone) {
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      isHorizontalSwipe.current = null;
      setIsSwiping(true);
    }
  }, [enableSwipeBack, isHomePage]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping || !enableSwipeBack) return;
    
    const touch = e.touches[0];
    const diffX = touch.clientX - startX.current;
    const diffY = touch.clientY - startY.current;
    
    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }
    
    // Only process horizontal right swipes
    if (isHorizontalSwipe.current && diffX > 0) {
      setSwipeDistance(Math.min(diffX, threshold * 1.5));
    }
  }, [isSwiping, enableSwipeBack, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;
    
    if (swipeDistance >= threshold && enableSwipeBack && !isHomePage) {
      // Navigate back
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }
    
    setSwipeDistance(0);
    setIsSwiping(false);
    isHorizontalSwipe.current = null;
  }, [isSwiping, swipeDistance, threshold, enableSwipeBack, isHomePage, navigate]);

  const progress = Math.min(swipeDistance / threshold, 1);

  return (
    <div
      className="relative min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Back gesture indicator */}
      {enableSwipeBack && !isHomePage && swipeDistance > 0 && (
        <div
          className="fixed left-0 top-1/2 -translate-y-1/2 z-[200] pointer-events-none"
          style={{
            opacity: progress,
            transform: `translateX(${swipeDistance * 0.3}px) translateY(-50%)`,
          }}
        >
          <div 
            className="w-10 h-10 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center border border-primary/30"
            style={{
              transform: `scale(${0.8 + progress * 0.2})`,
            }}
          >
            <ChevronLeft 
              className="h-5 w-5 text-primary" 
              style={{ 
                transform: `rotate(${(1 - progress) * -45}deg)`,
                opacity: 0.6 + progress * 0.4,
              }}
            />
          </div>
        </div>
      )}

      {/* Content with subtle translate effect */}
      <div
        className="min-h-screen transition-transform duration-75"
        style={{
          transform: swipeDistance > 0 ? `translateX(${swipeDistance * 0.05}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
