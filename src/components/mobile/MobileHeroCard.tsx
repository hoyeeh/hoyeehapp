import { Play, Plus, Check } from "lucide-react";
import { Content } from "@/types";
import { cn } from "@/lib/utils";
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
    <div className="relative w-full overflow-hidden animate-fade-in">
      {/* Background Image - Full width, no margins */}
      <div className="relative aspect-[3/4] w-full">
        <img
          src={content.thumbnailUrl}
          alt={content.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
        
        {/* Hoyeeh Badge */}
        <div className="absolute top-4 left-4">
          <img src={badge} alt="Hoyeeh" className="h-7 w-auto opacity-95" />
        </div>

        {/* Content Info */}
        <div className="absolute bottom-0 left-0 right-0 p-5 space-y-4">
          {/* Title */}
          <h2 className="font-display text-3xl font-bold text-white leading-tight drop-shadow-lg">
            {content.title}
          </h2>
          
          {/* Genre Tags */}
          <div className="flex items-center gap-2 text-sm text-white/80">
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
                "flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-lg",
                "bg-white text-black font-semibold",
                "active:scale-95 transition-all duration-200",
                "shadow-lg shadow-white/20"
              )}
            >
              <Play className="h-5 w-5" fill="currentColor" />
              Play
            </button>

            {/* My List Button */}
            <button
              onClick={() => onToggleList(content)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-lg",
                "bg-white/20 text-white font-semibold",
                "border border-white/30 backdrop-blur-sm",
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
