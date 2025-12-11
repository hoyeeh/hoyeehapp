import { useState, useRef, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface SwipeNavigationProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  enableBackGesture?: boolean;
  threshold?: number;
}

export function SwipeNavigation({ 
  children, 
  onSwipeLeft, 
  onSwipeRight,
  enableBackGesture = true,
  threshold = 100 
}: SwipeNavigationProps) {
  const navigate = useNavigate();
  const [swipeDistance, setSwipeDistance] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;
    
    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }
    
    // Only process horizontal swipes
    if (isHorizontalSwipe.current && enableBackGesture) {
      // Only allow right swipe from left edge for back gesture
      if (startX.current < 30 && diffX > 0) {
        setSwipeDistance(Math.min(diffX, threshold * 1.5));
      }
    }
  }, [isSwiping, enableBackGesture, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;
    
    if (swipeDistance >= threshold && enableBackGesture) {
      // Trigger back navigation
      navigate(-1);
    }
    
    setSwipeDistance(0);
    setIsSwiping(false);
    isHorizontalSwipe.current = null;
  }, [isSwiping, swipeDistance, threshold, enableBackGesture, navigate]);

  const progress = Math.min(swipeDistance / threshold, 1);

  return (
    <div
      className="relative h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Back gesture indicator */}
      {enableBackGesture && swipeDistance > 0 && (
        <div
          className="fixed left-0 top-1/2 -translate-y-1/2 z-[200] pointer-events-none"
          style={{
            opacity: progress,
            transform: `translateX(${swipeDistance * 0.3}px) translateY(-50%)`,
          }}
        >
          <div className="w-10 h-10 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center border border-primary/30">
            <svg 
              className="h-5 w-5 text-primary" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              style={{ transform: `rotate(${(1 - progress) * 180}deg)` }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="h-full transition-transform duration-75"
        style={{
          transform: swipeDistance > 0 ? `translateX(${swipeDistance * 0.1}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
