import { Content } from "@/types";
import { Play, Plus, Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentCardProps {
  content: Content;
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  isInList?: boolean;
  size?: "sm" | "md" | "lg";
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal";
}

export const ContentCard = ({
  content,
  onPlay,
  onToggleList,
  onDetails,
  isInList = false,
  size = "md",
  cardStyle = "poster",
}: ContentCardProps) => {
  const sizeClasses = {
    sm: "w-32 md:w-40",
    md: "w-40 md:w-52",
    lg: "w-48 md:w-64",
  };

  const aspectRatios = {
    poster: "aspect-[2/3]",
    backdrop: "aspect-video",
    wide: "aspect-video", // 16:9 for wide cards
    square: "aspect-square",
    minimal: "aspect-[3/2]",
  };

  const cardWidths = {
    poster: sizeClasses[size],
    backdrop: size === "sm" ? "w-56 md:w-72" : size === "md" ? "w-72 md:w-80" : "w-80 md:w-96",
    wide: size === "sm" ? "w-56 md:w-72" : size === "md" ? "w-72 md:w-80" : "w-80 md:w-96", // Wider for 16:9
    square: size === "sm" ? "w-32 md:w-40" : size === "md" ? "w-40 md:w-48" : "w-48 md:w-56",
    minimal: size === "sm" ? "w-48 md:w-56" : size === "md" ? "w-56 md:w-64" : "w-64 md:w-80",
  };

  if (cardStyle === "minimal") {
    return (
      <div
        className={cn(
          "group relative flex-shrink-0 cursor-pointer transition-all duration-300 hover:scale-102",
          cardWidths[cardStyle]
        )}
        onClick={() => onDetails(content)}
      >
        <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-secondary via-secondary/80 to-muted p-4 hover:bg-secondary/80">
          <div className="flex items-start gap-3">
            <img
              src={content.thumbnailUrl}
              alt={content.title}
              className="w-16 h-24 object-cover rounded"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm line-clamp-2">{content.title}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                {content.year && <span>{content.year}</span>}
                {content.rating && <span>⭐ {content.rating}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{content.description}</p>
              {content.isPremium && (
                <span className="inline-block mt-2 bg-brand px-2 py-0.5 rounded text-xs font-semibold text-primary-foreground">
                  PREMIUM
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={(e) => { e.stopPropagation(); onPlay(content); }}
              className="flex-1 py-2 rounded bg-foreground text-background text-xs font-medium hover:bg-foreground/90 flex items-center justify-center gap-1"
            >
              <Play className="h-3 w-3" fill="currentColor" /> Play
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleList(content); }}
              className="px-3 py-2 rounded border border-muted-foreground/30 hover:border-foreground"
            >
              {isInList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex-shrink-0 cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-10",
        cardWidths[cardStyle]
      )}
    >
      {/* Thumbnail */}
      <div 
        className={cn("relative rounded-lg overflow-hidden bg-secondary", aspectRatios[cardStyle])}
        onClick={() => onDetails(content)}
      >
        <img
          src={content.thumbnailUrl}
          alt={content.title}
          className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
          loading="lazy"
        />
        
        {/* Premium Badge */}
        {content.isPremium && (
          <div className="absolute top-2 left-2 bg-brand px-2 py-0.5 rounded text-xs font-semibold text-primary-foreground">
            PREMIUM
          </div>
        )}

        {/* Info overlay for backdrop and wide styles */}
        {(cardStyle === "backdrop" || cardStyle === "wide") && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background via-background/80 to-transparent">
            <h3 className="font-semibold text-sm">{content.title}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {content.year && <span>{content.year}</span>}
              {content.rating && <span>⭐ {content.rating}</span>}
              {content.genre && <span>{content.genre}</span>}
            </div>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Hover Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay(content);
            }}
            className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-colors"
          >
            <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleList(content);
            }}
            className="w-10 h-10 rounded-full border-2 border-muted-foreground/50 text-foreground flex items-center justify-center hover:border-foreground transition-colors"
          >
            {isInList ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Title & Info - not shown on backdrop/wide styles (already in overlay) */}
      {cardStyle !== "backdrop" && cardStyle !== "wide" && (
        <div className="mt-2 px-1">
          <h3 className="font-medium text-sm truncate">{content.title}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            {content.year && <span>{content.year}</span>}
            {content.rating && (
              <span className="border border-muted-foreground/30 px-1 rounded">
                {content.rating}
              </span>
            )}
            <span className="capitalize">{content.contentType}</span>
          </div>
        </div>
      )}
    </div>
  );
};
