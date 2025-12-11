import { useRef, useState, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { Content } from "@/types";
import { MobileContentCard } from "./MobileContentCard";
import { cn } from "@/lib/utils";

interface SwipeableContentRowProps {
  title: string;
  content: Content[];
  onPlay?: (content: Content) => void;
  onDetails: (content: Content) => void;
  variant?: "poster" | "landscape" | "continue";
  showSeeAll?: boolean;
  onSeeAll?: () => void;
  showRank?: boolean;
  progressMap?: Record<string, number>;
}

export function SwipeableContentRow({
  title,
  content,
  onPlay,
  onDetails,
  variant = "poster",
  showSeeAll = false,
  onSeeAll,
  showRank = false,
  progressMap,
}: SwipeableContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const cardWidth = variant === "landscape" ? 160 : variant === "continue" ? 128 : 112;
  const gap = 12;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    startX.current = e.touches[0].clientX;
    scrollLeft.current = scrollRef.current?.scrollLeft || 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !scrollRef.current) return;
    
    const x = e.touches[0].clientX;
    const walk = startX.current - x;
    scrollRef.current.scrollLeft = scrollLeft.current + walk;
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    
    if (scrollRef.current) {
      const scrollPos = scrollRef.current.scrollLeft;
      const newIndex = Math.round(scrollPos / (cardWidth + gap));
      setCurrentIndex(Math.max(0, Math.min(newIndex, content.length - 1)));
      
      // Smooth snap to card
      scrollRef.current.scrollTo({
        left: newIndex * (cardWidth + gap),
        behavior: 'smooth'
      });
    }
  }, [cardWidth, gap, content.length]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current && !isDragging) {
      const scrollPos = scrollRef.current.scrollLeft;
      const newIndex = Math.round(scrollPos / (cardWidth + gap));
      setCurrentIndex(Math.max(0, Math.min(newIndex, content.length - 1)));
    }
  }, [isDragging, cardWidth, gap, content.length]);

  if (content.length === 0) return null;

  return (
    <section className="mb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        {showSeeAll && (
          <button 
            onClick={onSeeAll}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          >
            See All
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Scrollable Content with touch handling */}
      <div 
        ref={scrollRef}
        className={cn(
          "flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar",
          "scroll-smooth snap-x snap-mandatory"
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onScroll={handleScroll}
      >
        {content.map((item, index) => (
          <div key={item.id} className="snap-start">
            <MobileContentCard
              content={item}
              onPlay={onPlay}
              onDetails={onDetails}
              variant={variant}
              rank={showRank ? index + 1 : undefined}
              progress={progressMap?.[item.id]}
            />
          </div>
        ))}
      </div>

      {/* Scroll Indicator Dots (optional, for featured rows) */}
      {content.length > 3 && variant === "landscape" && (
        <div className="flex justify-center gap-1.5 mt-2">
          {Array.from({ length: Math.min(content.length, 5) }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                i === Math.min(currentIndex, 4) 
                  ? "bg-primary w-4" 
                  : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
