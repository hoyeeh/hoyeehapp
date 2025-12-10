import { Content } from "@/types";
import { Play, Plus, Check, Info } from "lucide-react";
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
    wide: "aspect-video",
    square: "aspect-square",
    minimal: "aspect-[3/2]",
  };

  const cardWidths = {
    poster: sizeClasses[size],
    backdrop: size === "sm" ? "w-56 md:w-72" : size === "md" ? "w-72 md:w-80" : "w-80 md:w-96",
    wide: size === "sm" ? "w-56 md:w-72" : size === "md" ? "w-72 md:w-80" : "w-80 md:w-96",
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
        "netflix-card group relative flex-shrink-0 cursor-pointer",
        cardWidths[cardStyle]
      )}
    >
      {/* Thumbnail */}
      <div 
        className={cn(
          "relative rounded-md overflow-hidden bg-secondary shadow-lg",
          "ring-0 group-hover:ring-2 ring-foreground/20 transition-all duration-300",
          aspectRatios[cardStyle]
        )}
        onClick={() => onDetails(content)}
      >
        <img
          src={content.thumbnailUrl}
          alt={content.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Premium Badge */}
        {content.isPremium && (
          <div className="absolute top-2 left-2 bg-brand px-2 py-0.5 rounded text-xs font-semibold text-primary-foreground shadow-lg">
            PREMIUM
          </div>
        )}

        {/* Netflix-style gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Hover Info Panel - Netflix Style */}
        <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(content);
              }}
              className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-all hover:scale-110 shadow-lg"
            >
              <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleList(content);
              }}
              className={cn(
                "w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
                isInList 
                  ? "border-brand bg-brand/20 text-brand" 
                  : "border-muted-foreground/50 text-foreground hover:border-foreground"
              )}
            >
              {isInList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDetails(content);
              }}
              className="w-9 h-9 rounded-full border-2 border-muted-foreground/50 text-foreground flex items-center justify-center hover:border-foreground transition-all hover:scale-110 ml-auto"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          {/* Title & Meta */}
          <h3 className="font-semibold text-sm line-clamp-1 text-shadow-netflix">{content.title}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            {content.rating && (
              <span className="text-green-500 font-semibold">{content.rating}</span>
            )}
            {content.year && <span>{content.year}</span>}
            {content.duration && content.duration > 0 && (
              <span>
                {Math.floor(content.duration / 3600) > 0 
                  ? `${Math.floor(content.duration / 3600)}h ${Math.floor((content.duration % 3600) / 60)}m`
                  : `${Math.floor(content.duration / 60)}m`}
              </span>
            )}
          </div>
          {content.genre && (
            <div className="flex flex-wrap gap-1 mt-1">
              {content.genre.split(',').slice(0, 2).map((g, i) => (
                <span key={i} className="text-xs text-muted-foreground">{g.trim()}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Title below card - for non-hover state */}
      {cardStyle !== "backdrop" && cardStyle !== "wide" && (
        <div className="mt-2 px-0.5 group-hover:opacity-0 transition-opacity">
          <h3 className="font-medium text-sm truncate">{content.title}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {content.year && <span>{content.year}</span>}
            <span className="capitalize">{content.contentType}</span>
          </div>
        </div>
      )}
    </div>
  );
};
