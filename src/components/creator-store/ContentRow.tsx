import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { EnhancedContentCard } from "./EnhancedContentCard";
import { cn } from "@/lib/utils";

interface ContentRowProps {
  title: string;
  items: any[];
  onItemClick: (item: any) => void;
  onSeeAll?: () => void;
  showSeeAll?: boolean;
  cardVariant?: 'default' | 'large';
}

export function ContentRow({ 
  title, 
  items, 
  onItemClick, 
  onSeeAll,
  showSeeAll = true,
  cardVariant = 'default'
}: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">{title}</h2>
        {showSeeAll && onSeeAll && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-primary gap-1"
            onClick={onSeeAll}
          >
            See All
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content Row */}
      <div className="relative group">
        {/* Scroll Buttons */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 hover:bg-background backdrop-blur-sm h-10 w-10 rounded-full -ml-5 shadow-lg"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 hover:bg-background backdrop-blur-sm h-10 w-10 rounded-full -mr-5 shadow-lg"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex-shrink-0",
                cardVariant === 'large' 
                  ? "w-40 md:w-48 lg:w-56" 
                  : "w-32 md:w-40 lg:w-44"
              )}
            >
              <EnhancedContentCard
                item={item}
                onClick={() => onItemClick(item)}
                variant={cardVariant}
              />
            </div>
          ))}
        </div>

        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
