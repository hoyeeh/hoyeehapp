import { Content } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

interface Top10RowProps {
  content: Array<{ rank: number; content: Content }>;
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
  title?: string;
}

export const Top10Row = ({ content, onPlay, onDetails, title }: Top10RowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!content.length) return null;

  return (
    <section className="mb-8">
      <h2 className="font-display text-xl md:text-2xl mb-4 px-4 md:px-12 flex items-center gap-2">
        {title ? (
          title
        ) : (
          <>
            <span className="text-brand">Top 10</span> in Hoyeeh Today
          </>
        )}
      </h2>
      
      <div className="relative group/row">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-background to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
        
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-background to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-8 w-8" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {content.map((item) => (
            <div
              key={item.content.id}
              className="relative flex-shrink-0 cursor-pointer group"
              onClick={() => onDetails(item.content)}
            >
              {/* Large rank number */}
              <div className="absolute -left-2 bottom-0 z-10">
                <span 
                  className="text-[120px] font-black leading-none"
                  style={{
                    WebkitTextStroke: "3px hsl(var(--muted-foreground) / 0.5)",
                    WebkitTextFillColor: "transparent",
                    textShadow: "4px 4px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  {item.rank}
                </span>
              </div>
              
              {/* Content poster */}
              <div className="relative w-32 md:w-40 ml-12 aspect-[2/3] rounded-lg overflow-hidden bg-secondary group-hover:ring-2 group-hover:ring-brand transition-all">
                <img
                  src={item.content.thumbnailUrl || "/placeholder.svg"}
                  alt={item.content.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Top 10 Badge */}
                <div className="absolute bottom-0 right-0 bg-destructive text-destructive-foreground px-2 py-1 text-xs font-bold rounded-tl">
                  TOP 10
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
