import { Content } from "@/types";
import { Play } from "lucide-react";
import { motion } from "framer-motion";

interface KidsMobileContentCardProps {
  content: Content;
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
  index: number;
  variant?: "default" | "large" | "featured" | "full";
  cardSize?: "sm" | "md" | "lg"; // Admin-configured card size
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal" | "full"; // Admin-configured card style
  hasNewEpisode?: boolean;
  hasNewSeason?: boolean;
}

export const KidsMobileContentCard = ({ 
  content, 
  onPlay, 
  onDetails, 
  index,
  variant = "default",
  cardSize,
  cardStyle,
  hasNewEpisode = false,
  hasNewSeason = false
}: KidsMobileContentCardProps) => {
  
  // Determine effective variant based on cardStyle (admin setting takes priority)
  const effectiveVariant = cardStyle === "full" 
    ? "full" 
    : cardSize 
      ? (cardSize === "lg" ? "large" : cardSize === "sm" ? "default" : "default")
      : variant;

  // Standard poster sizes (2:3 aspect ratio)
  const sizes = {
    default: "w-[120px]",
    large: "w-[140px]",
    featured: "w-[200px]",
    full: "w-[140px]", // Full style uses 3:4 aspect ratio
  };
  
  // Override with admin sizes if cardSize is provided
  const adminSizes: Record<string, string> = {
    sm: "w-[100px]",
    md: "w-[120px]",
    lg: "w-[160px]",
  };

  // Full style sizes (larger to accommodate 3:4 aspect)
  const fullSizes: Record<string, string> = {
    sm: "w-[110px]",
    md: "w-[130px]",
    lg: "w-[170px]",
  };
  
  const widthClass = cardStyle === "full" && cardSize
    ? fullSizes[cardSize]
    : cardSize 
      ? adminSizes[cardSize] 
      : sizes[effectiveVariant as keyof typeof sizes] || sizes.default;

  // Use 3:4 aspect ratio for "full" style, 2:3 for posters
  const aspectRatio = cardStyle === "full" || effectiveVariant === "full" 
    ? "aspect-[3/4]" 
    : (variant === "featured" ? "aspect-[16/9]" : "aspect-[2/3]");

  return (
    <motion.div
      className={`${widthClass} flex-shrink-0`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.04, 
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
    >
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={() => onDetails(content)}
        className="relative rounded-2xl overflow-hidden bg-white/[0.04] cursor-pointer group"
      >
        <div className={`relative ${aspectRatio}`}>
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />

          {/* Rating badge */}
          {content.contentRating && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-white/90 tracking-wide">
                {content.contentRating}
              </span>
            </div>
          )}

          {/* New Season Badge - Compact single line */}
          {hasNewSeason && content.contentType === 'series' && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-1.5 py-0.5 text-[8px] font-bold rounded-full whitespace-nowrap">
              NEW SEASON
            </div>
          )}

          {/* New Episode Badge - Compact single line */}
          {hasNewEpisode && !hasNewSeason && content.contentType === 'series' && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-1.5 py-0.5 text-[8px] font-bold rounded-full whitespace-nowrap">
              NEW EPISODE
            </div>
          )}
        </div>
      </motion.div>
      
      <div className="mt-2.5 px-0.5">
        <h3 className="text-[13px] font-semibold text-white/90 truncate tracking-[-0.01em]">
          {content.title}
        </h3>
        {content.genre && (
          <p className="text-[11px] text-white/40 truncate mt-0.5 font-medium">
            {content.genre}
          </p>
        )}
      </div>
    </motion.div>
  );
};