import { Content } from "@/types";
import { ContentCardWithPreview } from "./ContentCardWithPreview";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ContentRowProps {
  title: string;
  content: Content[];
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  userList?: string[];
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal";
  showRank?: boolean;
  showSeeAll?: boolean;
  onSeeAll?: () => void;
}

export const ContentRow = ({
  title,
  content,
  onPlay,
  onToggleList,
  onDetails,
  userList = [],
  cardStyle = "poster",
  showRank = false,
  showSeeAll = false,
  onSeeAll,
}: ContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  if (!content.length) return null;

  return (
    <section className="group/section relative py-4 transition-all duration-300 hover:z-10">
      {/* Section Title - Netflix Style */}
      <div className="px-4 md:px-12 mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-lg md:text-xl lg:text-2xl text-foreground tracking-wide">
          {title}
        </h2>
        {(showSeeAll || onSeeAll) && (
          <button 
            onClick={onSeeAll}
            className="text-brand text-sm font-medium opacity-0 group-hover/section:opacity-100 transition-opacity cursor-pointer hover:underline"
          >
            Explore All →
          </button>
        )}
      </div>
      
      <div className="relative">
        {/* Left Scroll Button - Netflix style */}
        <button
          onClick={() => scroll("left")}
          className={cn(
            "absolute left-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center",
            "bg-gradient-to-r from-background via-background/90 to-transparent",
            "transition-all duration-300",
            showLeftArrow ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="w-10 h-10 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-secondary hover:scale-110 transition-all">
            <ChevronLeft className="h-6 w-6" />
          </div>
        </button>
        
        {/* Right Scroll Button - Netflix style */}
        <button
          onClick={() => scroll("right")}
          className={cn(
            "absolute right-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center",
            "bg-gradient-to-l from-background via-background/90 to-transparent",
            "transition-all duration-300",
            showRightArrow ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="w-10 h-10 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-secondary hover:scale-110 transition-all">
            <ChevronRight className="h-6 w-6" />
          </div>
        </button>

        {/* Content Scroll Container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-2 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {content.map((item, index) => (
            <div key={item.id} className="relative flex-shrink-0">
              {/* Rank Number for Top 10 style */}
              {showRank && (
                <div className="absolute -left-4 bottom-0 z-10 font-display text-[80px] md:text-[120px] leading-none text-transparent font-bold" 
                     style={{ 
                       WebkitTextStroke: '2px hsl(var(--muted-foreground))',
                       textShadow: '4px 4px 0 hsl(var(--background))'
                     }}>
                  {index + 1}
                </div>
              )}
              <ContentCardWithPreview
                content={item}
                onPlay={onPlay}
                onToggleList={onToggleList}
                onDetails={onDetails}
                isInList={userList.includes(item.id)}
                cardStyle={cardStyle}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
