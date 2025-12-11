import { useState, useRef, useCallback, ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number;
}

export function PullToRefresh({ onRefresh, children, threshold = 80 }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { mediumTap, successFeedback } = useHaptics();
  const hasTriggeredHaptic = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
      hasTriggeredHaptic.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      // Apply resistance to pull
      const resistance = 0.4;
      const pull = Math.min(diff * resistance, threshold * 1.5);
      setPullDistance(pull);

      // Haptic feedback when reaching threshold
      if (pull >= threshold && !hasTriggeredHaptic.current) {
        mediumTap();
        hasTriggeredHaptic.current = true;
      }
    }
  }, [isPulling, isRefreshing, threshold, mediumTap]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      try {
        await onRefresh();
        successFeedback();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh, successFeedback]);

  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-all duration-200 z-50",
          "pointer-events-none"
        )}
        style={{
          top: 0,
          height: pullDistance,
          opacity: progress,
        }}
      >
        <div className={cn(
          "w-10 h-10 rounded-full bg-primary/10 backdrop-blur-sm",
          "flex items-center justify-center border border-primary/20"
        )}>
          <RefreshCw 
            className={cn(
              "h-5 w-5 text-primary transition-transform",
              isRefreshing && "animate-spin"
            )}
            style={{
              transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content with transform */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
