import { Play, Plus, Check, Info } from "lucide-react";
import { Content } from "@/types";
import { cn } from "@/lib/utils";
import logo from "@/assets/hoyeeh-logo-web.png";
import badge from "@/assets/hoyeeh-badge.png";

interface MobileHeroCardProps {
  content: Content;
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  isInList?: boolean;
}

export function MobileHeroCard({ 
  content, 
  onPlay, 
  onToggleList, 
  onDetails,
  isInList = false 
}: MobileHeroCardProps) {
  return (
    <div className="relative mx-4 rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 animate-fade-in">
      {/* Background Image */}
      <div className="relative aspect-[2/3] max-h-[65vh]">
        <img
          src={content.thumbnailUrl}
          alt={content.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/40" />
        
        {/* Hoyeeh Badge */}
        <div className="absolute top-3 left-3">
          <img src={badge} alt="Hoyeeh" className="h-6 w-auto opacity-90" />
        </div>

        {/* Content Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
          {/* Title */}
          <h2 className="font-display text-2xl font-bold text-foreground leading-tight drop-shadow-lg">
            {content.title}
          </h2>
          
          {/* Genre Tags */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
  );
}
