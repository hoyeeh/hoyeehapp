import { Play, Plus, Check } from "lucide-react";
import { Content } from "@/types";
import { cn } from "@/lib/utils";
import badge from "@/assets/hoyeeh-badge.png";
import { Skeleton } from "@/components/ui/skeleton";

interface MobileHeroCardProps {
  content: Content;
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  isInList?: boolean;
}

// Skeleton component for hero loading state
export function MobileHeroSkeleton() {
  return (
    <div className="px-4">
      <div className="relative rounded-2xl overflow-hidden animate-pulse">
        <div className="relative aspect-[2/3] max-h-[55vh]">
          <Skeleton className="absolute inset-0 w-full h-full" />
          
          {/* Badge skeleton */}
          <div className="absolute top-3 left-3">
            <Skeleton className="h-6 w-16 rounded" />
          </div>

          {/* Content Info skeleton */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
            <Skeleton className="h-8 w-3/4 mx-auto rounded" />
            <div className="flex items-center justify-center gap-2">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Skeleton className="flex-1 h-12 rounded-lg" />
              <Skeleton className="flex-1 h-12 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileHeroCard({ 
  content, 
  onPlay, 
  onToggleList, 
  onDetails,
  isInList = false 
}: MobileHeroCardProps) {
  return (
    <div className="px-4">
      <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 animate-fade-in border border-border/20">
        {/* Background Image - Card format with rounded edges and proper padding */}
        <div className="relative aspect-[2/3] max-h-[55vh]">
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder.svg';
            }}
          />
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/40" />
          
          {/* Hoyeeh Badge */}
          <div className="absolute top-3 left-3">
            <img 
              src={badge} 
              alt="Hoyeeh" 
              className="h-6 w-auto opacity-90"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>

          {/* Content Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
            {/* Title - Centered */}
            <h2 className="text-center font-display text-2xl font-bold text-foreground leading-tight drop-shadow-lg">
              {content.title}
            </h2>
            
            {/* Genre Tags - Centered */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {content.genre?.split(',').slice(0, 3).map((g, i, arr) => (
                <span key={i} className="flex items-center">
                  {g.trim()}
                  {i < arr.length - 1 && <span className="mx-2 text-primary">•</span>}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-1">
              {/* Play Button */}
              <button
                onClick={() => onPlay(content)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg",
                  "bg-foreground text-background font-semibold",
                  "active:scale-95 transition-all duration-200",
                  "shadow-lg shadow-foreground/20"
                )}
              >
                <Play className="h-5 w-5" fill="currentColor" />
                Play
              </button>

              {/* My List Button */}
              <button
                onClick={() => onToggleList(content)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg",
                  "bg-secondary/80 text-foreground font-semibold",
                  "border border-border/50 backdrop-blur-sm",
                  "active:scale-95 transition-all duration-200"
                )}
              >
                {isInList ? (
                  <>
                    <Check className="h-5 w-5 text-primary" />
                    My List
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    My List
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
