import { ChevronRight } from "lucide-react";
import { Content } from "@/types";
import { MobileContentCard } from "./MobileContentCard";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TVShowUpdatesMap } from "@/hooks/useLatestTVShowUpdates";

interface MobileContentRowProps {
  title: string;
  content: Content[];
  onPlay?: (content: Content) => void;
  onDetails: (content: Content) => void;
  variant?: "poster" | "landscape" | "continue";
  showSeeAll?: boolean;
  onSeeAll?: () => void;
  showRank?: boolean;
  showNewBadge?: boolean; // Pass through to cards for "NEW"/"JUST ADDED" badges
  progressMap?: Record<string, number>;
  isLoading?: boolean;
  tvShowUpdates?: TVShowUpdatesMap; // Map of content IDs to new episode/season flags
}

// Skeleton components for different variants
function PosterSkeleton() {
  return (
    <div className="flex-shrink-0 w-[120px]">
      <Skeleton className="w-full aspect-[2/3] rounded-lg" />
      <Skeleton className="h-3 w-3/4 mt-2 rounded" />
    </div>
  );
}

function LandscapeSkeleton() {
  return (
    <div className="flex-shrink-0 w-[200px]">
      <Skeleton className="w-full aspect-video rounded-lg" />
      <Skeleton className="h-3 w-3/4 mt-2 rounded" />
    </div>
  );
}

function ContinueSkeleton() {
  return (
    <div className="flex-shrink-0 w-[160px]">
      <Skeleton className="w-full aspect-video rounded-lg" />
      <Skeleton className="h-1 w-full mt-2 rounded" />
      <Skeleton className="h-3 w-3/4 mt-1 rounded" />
    </div>
  );
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
  showNewBadge = false,
  progressMap,
  isLoading = false,
  tvShowUpdates = {},
}: MobileContentRowProps) {
  // Show skeleton when loading
  if (isLoading) {
    const SkeletonComponent = 
      variant === "landscape" ? LandscapeSkeleton : 
      variant === "continue" ? ContinueSkeleton : 
      PosterSkeleton;
    
    const skeletonCount = variant === "poster" ? 5 : 3;

    return (
      <section className="mb-6">
        {/* Header */}
        <div className="flex items-center justify-between px-4 mb-3">
          <Skeleton className="h-6 w-32 rounded" />
          {showSeeAll && <Skeleton className="h-5 w-16 rounded" />}
        </div>

        {/* Skeleton Cards */}
        <div className="flex gap-3 overflow-hidden px-4 pb-2">
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <SkeletonComponent key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (content.length === 0) return null;

  return (
    <section className="mb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
        {showSeeAll && onSeeAll && (
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
              showNewBadge={showNewBadge}
              hasNewEpisode={tvShowUpdates[item.id]?.hasNewEpisode}
              hasNewSeason={tvShowUpdates[item.id]?.hasNewSeason}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
