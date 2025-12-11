import { useState, useEffect } from "react";
import { Play, Plus, Check, Info } from "lucide-react";
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
      <div className="relative w-full aspect-[2/3] max-h-[60vh] rounded-2xl overflow-hidden animate-pulse">
        <Skeleton className="absolute inset-0 w-full h-full" />
        
        {/* Badge skeleton */}
        <div className="absolute top-3 left-4">
          <Skeleton className="h-6 w-16 rounded" />
        </div>

        {/* Content Info skeleton */}
        <div className="absolute bottom-0 left-0 right-0 p-5 space-y-3">
          <Skeleton className="h-8 w-3/4 mx-auto rounded" />
          <div className="flex items-center justify-center gap-2">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-12 w-28 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
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
  const [scrollY, setScrollY] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Track scroll for parallax effect
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate parallax transform (subtle movement)
  const parallaxOffset = scrollY * 0.3;

  return (
    <div className="px-4">
      <div 
        className={cn(
          "relative w-full aspect-[2/3] max-h-[60vh] rounded-2xl overflow-hidden",
          "shadow-2xl shadow-primary/10 border border-border/20",
          isLoaded ? "animate-scale-in" : "opacity-0"
        )}
      >
        {/* Background Image with Parallax */}
        <img
          src={content.thumbnailUrl}
          alt={content.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-100 ease-out"
          style={{ transform: `translateY(${parallaxOffset}px) scale(1.1)` }}
          onLoad={() => setIsLoaded(true)}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.svg';
            setIsLoaded(true);
          }}
        />
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent h-32" />
        
        {/* Hoyeeh Badge */}
        <div className="absolute top-3 left-4 z-10">
          <img 
            src={badge} 
            alt="Hoyeeh" 
            className="h-7 w-auto opacity-90 drop-shadow-lg"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>

        {/* Content Info */}
        <div className="absolute bottom-0 left-0 right-0 p-5 space-y-3">
          {/* Title - Centered */}
          <h2 className="text-center font-display text-3xl font-bold text-foreground leading-tight drop-shadow-lg">
            {content.title}
          </h2>
          
          {/* Genre Tags - Centered */}
          <div className="flex items-center justify-center flex-wrap gap-1 text-sm text-muted-foreground">
            {content.genre?.split(',').slice(0, 3).map((g, i, arr) => (
              <span key={i} className="flex items-center">
                {g.trim()}
                {i < arr.length - 1 && <span className="mx-2 text-primary">•</span>}
              </span>
            ))}
          </div>

          {/* Action Buttons - Centered with Icon Buttons */}
          <div className="flex items-center justify-center gap-4 pt-2">
            {/* My List Button - Circle */}
            <button
              onClick={() => onToggleList(content)}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-full",
                "bg-secondary/60 backdrop-blur-sm border border-border/50",
                "active:scale-90 transition-all duration-200"
              )}
              aria-label={isInList ? "Remove from list" : "Add to list"}
            >
              {isInList ? (
                <Check className="h-5 w-5 text-primary" />
              ) : (
                <Plus className="h-5 w-5 text-foreground" />
              )}
            </button>

            {/* Play Button - Primary */}
            <button
              onClick={() => onPlay(content)}
              className={cn(
                "flex items-center justify-center gap-2 py-3 px-8 rounded-full",
                "bg-foreground text-background font-semibold",
                "active:scale-95 transition-all duration-200",
                "shadow-lg shadow-foreground/30"
              )}
            >
              <Play className="h-5 w-5" fill="currentColor" />
              Play
            </button>

            {/* Info Button - Circle */}
            <button
              onClick={() => onDetails(content)}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-full",
                "bg-secondary/60 backdrop-blur-sm border border-border/50",
                "active:scale-90 transition-all duration-200"
              )}
              aria-label="More info"
            >
              <Info className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
