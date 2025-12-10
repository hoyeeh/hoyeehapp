import { Content } from "@/types";
import { ContentCard } from "./ContentCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

interface ContentRowProps {
  title: string;
  content: Content[];
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  userList?: string[];
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal";
}

export const ContentRow = ({
  title,
  content,
  onPlay,
  onToggleList,
  onDetails,
  userList = [],
  cardStyle = "poster",
}: ContentRowProps) => {
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
      <h2 className="font-display text-xl md:text-2xl mb-4 px-4 md:px-12">{title}</h2>
      
      <div className="relative group/row">
        {/* Scroll Buttons */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-8 z-10 w-12 bg-gradient-to-r from-background to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
        
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-8 z-10 w-12 bg-gradient-to-l from-background to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-8 w-8" />
        </button>

        {/* Content Scroll */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {content.map((item) => (
            <ContentCard
              key={item.id}
              content={item}
              onPlay={onPlay}
              onToggleList={onToggleList}
              onDetails={onDetails}
              isInList={userList.includes(item.id)}
              cardStyle={cardStyle}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
