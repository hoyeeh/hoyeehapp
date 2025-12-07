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
}

export const ContentCard = ({
  content,
  onPlay,
  onToggleList,
  onDetails,
  isInList = false,
  size = "md",
}: ContentCardProps) => {
  const sizeClasses = {
    sm: "w-32 md:w-40",
    md: "w-40 md:w-52",
    lg: "w-48 md:w-64",
  };

  return (
    <div
      className={cn(
        "group relative flex-shrink-0 cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-10",
        sizeClasses[size]
      )}
    >
      {/* Thumbnail */}
      <div 
        className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary"
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

      {/* Title & Info */}
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
    </div>
  );
};
