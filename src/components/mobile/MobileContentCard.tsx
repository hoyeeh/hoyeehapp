import { Play, Info, MoreVertical, CloudOff, ShoppingBag, CheckCircle } from "lucide-react";
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
  variant?: "poster" | "landscape" | "continue" | "grid";
  cardSize?: "sm" | "md" | "lg"; // Admin-configured card size
  rank?: number;
  progress?: number;
  showBadges?: boolean;
  showNewBadge?: boolean; // Explicit control for "NEW"/"JUST ADDED" badges
  isDownloaded?: boolean;
  isPaidContent?: boolean; // Indicates this is creator-paid content
  hasPurchased?: boolean; // Indicates user has purchased this paid content
  price?: number; // Price for paid content
  currency?: string; // Currency for paid content
  hasNewEpisode?: boolean; // Show "New Episode" badge for TV shows
  hasNewSeason?: boolean; // Show "New Season" badge for TV shows
}

// Fallback placeholder for broken images
const PLACEHOLDER_IMAGE = '/placeholder.svg';

export function MobileContentCard({ 
  content, 
  onPlay,
  onDetails, 
  variant = "poster",
  cardSize = "md",
  rank,
  progress,
  showBadges = true,
  showNewBadge = false, // Default to false - only show when explicitly enabled
  isDownloaded = false,
  isPaidContent = false,
  hasPurchased = false,
  price,
  currency = 'XAF',
  hasNewEpisode = false,
  hasNewSeason = false
}: MobileContentCardProps) {
  // Map card size to width classes - used when not in flex container with size set
  const sizeWidthClasses = {
    sm: "w-24",
    md: "w-28", 
    lg: "w-36",
  };
  const [imageError, setImageError] = useState(false);
  const [badgeError, setBadgeError] = useState(false);
  const { isOnline } = useNetworkStatus();
  
  // Show NEW badge only for content added within 5 days
  const isNewlyAdded = content.createdAt && 
    new Date(content.createdAt) > subDays(new Date(), 5);
  
  // Show offline badge when device is offline and content is downloaded
  const showOfflineBadge = !isOnline && isDownloaded;
  const handleImageError = () => {
    setImageError(true);
  };

  const thumbnailSrc = imageError ? PLACEHOLDER_IMAGE : (content.thumbnailUrl || PLACEHOLDER_IMAGE);

  // Continue watching variant - scale based on cardSize
  const continueSizeClasses = {
    sm: "w-28",
    md: "w-32",
    lg: "w-40",
  };
  
  if (variant === "continue") {
    return (
      <div 
        className={cn("relative flex-shrink-0 group active:scale-95 transition-transform", continueSizeClasses[cardSize])}
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
          {showNewBadge && isNewlyAdded && (
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

  // Landscape variant - scale width based on cardSize
  const landscapeSizeClasses = {
    sm: "w-32",
    md: "w-40",
    lg: "w-48",
  };
  
  if (variant === "landscape") {
    return (
      <div 
        className={cn("relative flex-shrink-0 active:scale-95 transition-transform", landscapeSizeClasses[cardSize])}
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

  // Map card size to poster width for ranked cards
  const rankPosterSizeClasses = {
    sm: "w-20",
    md: "w-24",
    lg: "w-28",
  };

  // Map card size to rank number font size
  const rankFontSizeClasses = {
    sm: "text-[60px]",
    md: "text-[80px]",
    lg: "text-[100px]",
  };

  // Default poster variant - with Top 10 style ranking
  if (rank) {
    return (
      <div 
        className="relative flex-shrink-0 active:scale-95 transition-transform"
        onClick={() => onDetails(content)}
      >
        <div className="flex items-end">
          {/* Large rank number - Netflix/Desktop style */}
          <div className="relative z-10 -mr-2">
            <span 
              className={cn(rankFontSizeClasses[cardSize], "font-black leading-none select-none")}
              style={{
                WebkitTextStroke: "2px hsl(var(--muted-foreground) / 0.5)",
                WebkitTextFillColor: "transparent",
                textShadow: "3px 3px 6px rgba(0,0,0,0.5)",
              }}
            >
              {rank}
            </span>
          </div>
          
          {/* Poster - uses cardSize prop */}
          <div className={cn("relative aspect-[2/3] rounded-xl overflow-hidden bg-secondary shadow-lg ring-1 ring-border/10", rankPosterSizeClasses[cardSize])}>
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

            {/* Top 10 Badge */}
            <div className="absolute bottom-0 right-0 bg-destructive text-destructive-foreground px-1.5 py-0.5 text-[9px] font-bold rounded-tl">
              TOP 10
            </div>
          </div>
        </div>

        {/* Title */}
        <h4 className="mt-1.5 text-xs font-medium line-clamp-2 px-0.5 text-foreground/90 ml-8">
          {content.title}
        </h4>
      </div>
    );
  }

  // Grid variant - responsive for 3-column layouts
  if (variant === "grid") {
    return (
      <div 
        className="relative w-full active:scale-95 transition-transform"
        onClick={() => onDetails(content)}
      >
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary shadow-md ring-1 ring-border/10">
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
            <div className="absolute top-1 left-1">
              <img 
                src={badge} 
                alt="Hoyeeh" 
                className="h-2.5 w-auto opacity-80"
                onError={() => setBadgeError(true)}
              />
            </div>
          )}
          
          {/* Offline Available Badge */}
          {showOfflineBadge && (
            <div className="absolute top-1 right-1 bg-green-600 rounded-full p-0.5">
              <CloudOff className="h-2.5 w-2.5 text-white" />
            </div>
          )}

          {/* Paid Access Badge - Show when user has purchased */}
          {isPaidContent && hasPurchased && !showOfflineBadge && (
            <div className="absolute top-1 right-1 bg-green-500 rounded-md px-1 py-0.5 flex items-center gap-0.5">
              <CheckCircle className="h-2 w-2 text-white" />
              <span className="text-[7px] font-bold text-white">Paid Access</span>
            </div>
          )}

          {/* Paid Content Badge - Show price when not purchased */}
          {isPaidContent && !hasPurchased && !showOfflineBadge && (
            <div className="absolute top-1 right-1 bg-amber-500 rounded-md px-1 py-0.5 flex items-center gap-0.5">
              <ShoppingBag className="h-2 w-2 text-white" />
              {price !== undefined && (
                <span className="text-[7px] font-bold text-white">
                  {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: currency,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(price)}
                </span>
              )}
            </div>
          )}

          {/* New Season Badge - Compact */}
          {hasNewSeason && content.contentType === 'series' && (
            <div className="absolute bottom-0 left-0 right-0 bg-destructive py-0.5">
              <span className="block text-center text-[7px] font-bold text-destructive-foreground whitespace-nowrap">
                NEW SEASON
              </span>
            </div>
          )}

          {/* New Episode Badge - Compact */}
          {hasNewEpisode && !hasNewSeason && content.contentType === 'series' && (
            <div className="absolute bottom-0 left-0 right-0 bg-destructive py-0.5">
              <span className="block text-center text-[7px] font-bold text-destructive-foreground whitespace-nowrap">
                NEW EPISODE
              </span>
            </div>
          )}

          {/* New Badge - Compact */}
          {showNewBadge && isNewlyAdded && !hasNewSeason && !hasNewEpisode && (
            <div className="absolute bottom-0 left-0 right-0 bg-primary py-0.5">
              <span className="block text-center text-[7px] font-bold text-primary-foreground whitespace-nowrap">
                NEW
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h4 className="mt-1 text-[11px] font-medium line-clamp-2 text-foreground/90">
          {content.title}
        </h4>
      </div>
    );
  }

  // Standard poster variant (no rank) - use cardSize for width
  return (
    <div 
      className={cn("relative flex-shrink-0 active:scale-95 transition-transform", sizeWidthClasses[cardSize])}
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

        {/* Paid Access Badge - Show when user has purchased */}
        {isPaidContent && hasPurchased && !showOfflineBadge && (
          <div className="absolute top-1.5 right-1.5 bg-green-500 rounded-md px-1.5 py-0.5 flex items-center gap-1">
            <CheckCircle className="h-2.5 w-2.5 text-white" />
            <span className="text-[8px] font-bold text-white">Paid Access</span>
          </div>
        )}

        {/* Paid Content Badge - Show price when not purchased */}
        {isPaidContent && !hasPurchased && !showOfflineBadge && (
          <div className="absolute top-1.5 right-1.5 bg-amber-500 rounded-md px-1.5 py-0.5 flex items-center gap-1">
            <ShoppingBag className="h-2.5 w-2.5 text-white" />
            {price !== undefined && (
              <span className="text-[8px] font-bold text-white">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: currency,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(price)}
              </span>
            )}
          </div>
        )}

        {/* New Season Badge - Compact */}
        {hasNewSeason && content.contentType === 'series' && (
          <div className="absolute bottom-0 left-0 right-0 bg-destructive py-0.5">
            <span className="block text-center text-[8px] font-bold text-destructive-foreground whitespace-nowrap">
              NEW SEASON
            </span>
          </div>
        )}

        {/* New Episode Badge - Compact */}
        {hasNewEpisode && !hasNewSeason && content.contentType === 'series' && (
          <div className="absolute bottom-0 left-0 right-0 bg-destructive py-0.5">
            <span className="block text-center text-[8px] font-bold text-destructive-foreground whitespace-nowrap">
              NEW EPISODE
            </span>
          </div>
        )}

        {/* New Badge */}
        {showNewBadge && isNewlyAdded && !hasNewSeason && !hasNewEpisode && (
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
