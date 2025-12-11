import { ChevronRight } from "lucide-react";
import { Content } from "@/types";
import { MobileContentCard } from "./MobileContentCard";
import { cn } from "@/lib/utils";

interface MobileContentRowProps {
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

export function MobileContentRow({
  title,
  content,
  onPlay,
  onDetails,
  variant = "poster",
  showSeeAll = false,
  onSeeAll,
  showRank = false,
  progressMap,
}: MobileContentRowProps) {
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

      {/* Scrollable Content */}
      <div className={cn(
        "flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar",
        "scroll-smooth snap-x snap-mandatory"
      )}>
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
    </section>
  );
}
