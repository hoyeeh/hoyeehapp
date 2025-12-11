import { Play, Info, MoreVertical, CloudOff } from "lucide-react";
import { Content } from "@/types";
import { cn } from "@/lib/utils";
import badge from "@/assets/hoyeeh-badge.png";
import { subDays } from "date-fns";
import { useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

interface MobileContentCardProps {
  content: Content;
  onPlay?: (content: Content) => void;
  onDetails: (content: Content) => void;
  variant?: "poster" | "landscape" | "continue";
  rank?: number;
  progress?: number;
  showBadges?: boolean;
  isDownloaded?: boolean;
}

// Fallback placeholder for broken images
const PLACEHOLDER_IMAGE = '/placeholder.svg';

export function MobileContentCard({ 
  content, 
  onPlay,
  onDetails, 
  variant = "poster",
  rank,
  progress,
  showBadges = true,
  isDownloaded = false
}: MobileContentCardProps) {
  const [imageError, setImageError] = useState(false);
  const [badgeError, setBadgeError] = useState(false);
  const { isOnline } = useNetworkStatus();
  
  const isNewlyAdded = content.createdAt && 
    new Date(content.createdAt) > subDays(new Date(), 14);
  
  // Show offline badge when device is offline and content is downloaded
  const showOfflineBadge = !isOnline && isDownloaded;
  const handleImageError = () => {
    setImageError(true);
  };

  const thumbnailSrc = imageError ? PLACEHOLDER_IMAGE : (content.thumbnailUrl || PLACEHOLDER_IMAGE);

  if (variant === "continue") {
    return (
      <div 
        className="relative flex-shrink-0 w-32 group active:scale-95 transition-transform"
        onClick={() => onDetails(content)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary">
          <img
            src={thumbnailSrc}
            alt={content.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={handleImageError}
          />
          
          {/* Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-active:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-foreground/90 flex items-center justify-center">
              <Play className="h-5 w-5 text-background ml-0.5" fill="currentColor" />
            </div>
          </div>

          {/* Progress Bar */}
          {progress !== undefined && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}

          {/* Badges */}
          {showBadges && isNewlyAdded && (
            <div className="absolute bottom-2 left-2">
              <span className="px-1.5 py-0.5 bg-primary text-[10px] font-bold rounded text-primary-foreground">
                Recently Added
              </span>
            </div>
          )}
        </div>

        {/* Actions Row */}
        <div className="flex items-center justify-between mt-2 px-1">
          <button 
            className="p-1.5 rounded-full border border-border/50 hover:bg-secondary transition-colors"
            onClick={(e) => { e.stopPropagation(); onDetails(content); }}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          <button className="p-1.5 rounded-full border border-border/50 hover:bg-secondary transition-colors">
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (variant === "landscape") {
    return (
      <div 
        className="relative flex-shrink-0 w-40 active:scale-95 transition-transform"
        onClick={() => onDetails(content)}
      >
        <div className="relative aspect-video rounded-xl overflow-hidden bg-secondary shadow-lg">
          <img
            src={thumbnailSrc}
            alt={content.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={handleImageError}
          />
          
          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex items-center gap-1">
            {!badgeError && (
              <img 
                src={badge} 
                alt="Hoyeeh" 
                className="h-3 w-auto" 
                onError={() => setBadgeError(true)}
              />
            )}
            {rank && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 rounded">
                TOP {rank}
              </span>
            )}
          </div>

          {/* Title */}
          <div className="absolute bottom-2 left-2 right-2">
            <h4 className="text-sm font-semibold line-clamp-1 drop-shadow-lg">
              {content.title}
            </h4>
          </div>
        </div>
      </div>
    );
  }

  // Default poster variant
  return (
    <div 
      className="relative flex-shrink-0 w-28 active:scale-95 transition-transform"
      onClick={() => onDetails(content)}
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-secondary shadow-lg ring-1 ring-border/10">
        <img
          src={thumbnailSrc}
          alt={content.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={handleImageError}
        />
        
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
        
        {/* Badge */}
        {!badgeError && (
          <div className="absolute top-1.5 left-1.5">
            <img 
              src={badge} 
              alt="Hoyeeh" 
              className="h-3 w-auto opacity-80"
              onError={() => setBadgeError(true)}
            />
          </div>
        )}
        
        {/* Offline Available Badge */}
        {showOfflineBadge && (
          <div className="absolute top-1.5 right-1.5 bg-green-600 rounded-full p-1">
            <CloudOff className="h-3 w-3 text-white" />
          </div>
        )}

        {/* Rank Badge */}
        {rank && (
          <div className="absolute top-1.5 right-1.5">
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
              {rank}
            </span>
          </div>
        )}

        {/* New Badge */}
        {showBadges && isNewlyAdded && (
          <div className="absolute bottom-0 left-0 right-0 bg-primary py-0.5">
            <span className="block text-center text-[9px] font-bold text-primary-foreground">
              JUST ADDED
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="mt-1.5 text-xs font-medium line-clamp-2 px-0.5 text-foreground/90">
        {content.title}
      </h4>
      <p className="text-[10px] text-muted-foreground px-0.5">
        {content.genre?.split(',')[0]}
      </p>
    </div>
  );
}
