import { Content } from "@/types";
import { Play, Plus, Check, Info, Lock, Volume2, VolumeX, Download, Share2, ShoppingBag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContentRatingBadge } from "./ContentRatingBadge";
import { useState, useRef, useEffect, useMemo } from "react";
import { toCdnUrl } from "@/utils/cdnUrl";
import hoyeehBadge from "@/assets/hoyeeh-badge.png";
import { DownloadButton } from "./DownloadButton";
import { SocialShare } from "./SocialShare";

interface ContentCardWithPreviewProps {
  content: Content;
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  isInList?: boolean;
  size?: "sm" | "md" | "lg";
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal" | "full";
  isRestricted?: boolean;
  showTop10Badge?: boolean;
  showJustAddedBadge?: boolean;
  justAddedDays?: number; // Number of days to show "Just Added" badge (default: 2)
  isPaidContent?: boolean; // Indicates this is creator-paid content
  paidPrice?: number; // Price for paid content
  paidCurrency?: string; // Currency for paid content
  hasPurchased?: boolean; // Whether user has purchased this content
  isCheckingPurchase?: boolean; // Whether purchase check is in progress
  hasNewEpisode?: boolean; // Show "New Episode" badge for TV shows
  hasNewSeason?: boolean; // Show "New Season" badge for TV shows
}

export const ContentCardWithPreview = ({
  content,
  onPlay,
  onToggleList,
  onDetails,
  isInList = false,
  size = "md",
  cardStyle = "poster",
  isRestricted = false,
  showTop10Badge = false,
  showJustAddedBadge = false,
  justAddedDays = 5, // Default 5 days for most sections
  isPaidContent = false,
  paidPrice,
  paidCurrency = 'XAF',
  hasPurchased = false,
  isCheckingPurchase = false,
  hasNewEpisode = false,
  hasNewSeason = false,
}: ContentCardWithPreviewProps) => {
  // Check if content was added within the specified days
  const isJustAdded = useMemo(() => {
    if (!content.createdAt) return false;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - justAddedDays);
    return new Date(content.createdAt) > cutoffDate;
  }, [content.createdAt, justAddedDays]);

  // Show just added badge either if prop is true AND content is actually new within specified days
  const shouldShowJustAdded = showJustAddedBadge && isJustAdded;
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewDurationRef = useRef<NodeJS.Timeout | null>(null);

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
    full: "aspect-[3/4]",
  };

  // Backdrop cards should have the same HEIGHT as poster cards
  // Poster is 2/3 aspect ratio. To match height, we calculate based on poster width and height.
  // If poster width is W and aspect is 2/3, height H = W * 1.5
  // For backdrop with height H and 16/9 aspect, width = H * (16/9) = W * 1.5 * (16/9) = W * 2.67
  const cardWidths = {
    poster: sizeClasses[size],
    backdrop: size === "sm" ? "w-[14rem] md:w-[17.5rem]" : size === "md" ? "w-[17.5rem] md:w-[22.75rem]" : "w-[21rem] md:w-[28rem]",
    wide: size === "sm" ? "w-56 md:w-72" : size === "md" ? "w-72 md:w-80" : "w-80 md:w-96",
    square: size === "sm" ? "w-32 md:w-40" : size === "md" ? "w-40 md:w-48" : "w-48 md:w-56",
    minimal: size === "sm" ? "w-48 md:w-56" : size === "md" ? "w-56 md:w-64" : "w-64 md:w-80",
    full: size === "sm" ? "w-[14rem] md:w-[18rem]" : size === "md" ? "w-[18rem] md:w-[22rem]" : "w-[22rem] md:w-[26rem]",
  };

  // Use fixed height classes to match poster heights exactly
  // Poster aspect 2/3: for md (w-52 = 208px), height = 312px
  const aspectRatioClasses = {
    poster: aspectRatios[cardStyle],
    backdrop: size === "sm" ? "h-[15rem] md:h-[19.5rem]" : size === "md" ? "h-[19.5rem] md:h-[19.5rem]" : "h-[23.4rem] md:h-[24rem]",
    wide: aspectRatios[cardStyle],
    square: aspectRatios[cardStyle],
    minimal: aspectRatios[cardStyle],
    full: aspectRatios[cardStyle],
  };

  // Start time at 25 minutes (1500 seconds)
  const PREVIEW_START_TIME = 25 * 60;
  // Preview duration 20 seconds
  const PREVIEW_DURATION = 20;

  useEffect(() => {
    if (isHovered && content.videoUrl) {
      // Delay before showing preview to avoid accidental triggers
      hoverTimeoutRef.current = setTimeout(() => {
        setShowPreview(true);
      }, 500);
    } else {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (previewDurationRef.current) {
        clearTimeout(previewDurationRef.current);
      }
      setShowPreview(false);
    }

    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (previewDurationRef.current) {
        clearTimeout(previewDurationRef.current);
      }
    };
  }, [isHovered, content.videoUrl]);

  useEffect(() => {
    if (showPreview && videoRef.current) {
      const video = videoRef.current;
      video.currentTime = PREVIEW_START_TIME;
      video.play().catch(console.error);

      // Stop preview after 20 seconds
      previewDurationRef.current = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
          setShowPreview(false);
        }
      }, PREVIEW_DURATION * 1000);
    }
  }, [showPreview]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
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
        "netflix-card group relative flex-shrink-0 cursor-pointer transition-all duration-300",
        cardWidths[cardStyle],
        isHovered && "z-50"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Expanded Preview Card */}
      <div 
        className={cn(
          "absolute inset-0 transition-all duration-300 origin-center",
          isHovered 
            ? "scale-150 -translate-y-[25%] shadow-2xl rounded-lg overflow-hidden bg-card" 
            : "scale-100"
        )}
      >
        {/* Video Preview or Thumbnail */}
        <div 
          className={cn(
            "relative overflow-hidden bg-secondary",
            aspectRatioClasses[cardStyle]
          )}
          onClick={() => onDetails(content)}
        >
          {showPreview && content.videoUrl ? (
            <video
              ref={videoRef}
              src={toCdnUrl(content.videoUrl)}
              className="w-full h-full object-cover"
              muted={isMuted}
              playsInline
              loop={false}
            />
          ) : (
            <img
              src={content.thumbnailUrl}
              alt={content.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
          
          {/* Hoyeeh Brand Badge - Top Left */}
          <div className="absolute top-2 left-2 z-10">
            <img 
              src={hoyeehBadge} 
              alt="Hoyeeh" 
              className="w-6 h-6 object-contain drop-shadow-lg"
            />
          </div>

          {/* Badges - Top Right */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            <ContentRatingBadge rating={content.contentRating} size="sm" />
          </div>

          {/* Top 10 Badge - Bottom Right */}
          {showTop10Badge && (
            <div className="absolute bottom-0 right-0 bg-destructive text-destructive-foreground px-2 py-1 text-xs font-bold rounded-tl">
              TOP 10
            </div>
          )}

          {/* New Season Badge - Compact single line */}
          {hasNewSeason && !showTop10Badge && content.contentType === 'series' && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-2 py-0.5 text-[9px] font-bold rounded-full whitespace-nowrap">
              NEW SEASON
            </div>
          )}

          {/* New Episode Badge - Compact single line */}
          {hasNewEpisode && !hasNewSeason && !showTop10Badge && content.contentType === 'series' && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-2 py-0.5 text-[9px] font-bold rounded-full whitespace-nowrap">
              NEW EPISODE
            </div>
          )}

          {/* Just Added Badge - Compact single line */}
          {shouldShowJustAdded && !showTop10Badge && !hasNewSeason && !hasNewEpisode && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-2 py-0.5 text-[9px] font-bold rounded-full whitespace-nowrap">
              NEW RELEASE
            </div>
          )}

          {/* Paid Access Badge - Bottom of poster */}
          {isPaidContent && hasPurchased && !showTop10Badge && !shouldShowJustAdded && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-bold text-center py-1.5 shadow-md flex items-center justify-center gap-1">
              <Check className="h-3 w-3" />
              PAID ACCESS
            </div>
          )}
          {isPaidContent && !hasPurchased && paidPrice !== undefined && !showTop10Badge && !shouldShowJustAdded && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold text-center py-1.5 shadow-md flex items-center justify-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: paidCurrency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(paidPrice)}
            </div>
          )}

          {/* Mute Toggle when playing */}
          {showPreview && content.videoUrl && (
            <button
              onClick={toggleMute}
              className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Restricted Overlay */}
          {isRestricted && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {/* Locked Overlay for unpurchased paid content */}
          {isPaidContent && !hasPurchased && !isRestricted && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex flex-col items-center justify-end pb-4 pointer-events-none">
              <div className="bg-amber-500/90 backdrop-blur-sm rounded-full p-2 mb-2">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <span className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded-full">
                Purchase to unlock
              </span>
            </div>
          )}

          {/* Loading overlay when checking purchase */}
          {isCheckingPurchase && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )} />
        </div>

        {/* Info Panel - Only visible on hover */}
        <div className={cn(
          "bg-card p-3 transition-all duration-300",
          isHovered ? "opacity-100" : "opacity-0 h-0 p-0 overflow-hidden"
        )}>
          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 mb-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(content);
              }}
              className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-all hover:scale-110 shadow-lg"
            >
              <Play className="h-3 w-3 ml-0.5" fill="currentColor" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleList(content);
              }}
              className={cn(
                "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
                isInList 
                  ? "border-brand bg-brand/20 text-brand" 
                  : "border-muted-foreground/50 text-foreground hover:border-foreground"
              )}
            >
              {isInList ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </button>

            {/* Download Button */}
            <div onClick={(e) => e.stopPropagation()}>
              <DownloadButton content={content} variant="icon" />
            </div>

            {/* Share Button */}
            <div onClick={(e) => e.stopPropagation()}>
              <SocialShare content={content} variant="icon" />
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDetails(content);
              }}
              className="w-7 h-7 rounded-full border-2 border-muted-foreground/50 text-foreground flex items-center justify-center hover:border-foreground transition-all hover:scale-110 ml-auto"
            >
              <Info className="h-3 w-3" />
            </button>
          </div>

          {/* Title & Meta */}
          <h3 className="font-bold text-sm line-clamp-1 text-primary">{content.title}</h3>
          {content.genre && (
            <div className="flex flex-wrap gap-1 mt-1">
              {content.genre.split(',').slice(0, 3).map((g, i) => (
                <span key={i} className="text-xs text-foreground">{g.trim()}{i < Math.min(content.genre!.split(',').length, 3) - 1 ? ' •' : ''}</span>
              ))}
            </div>
          )}
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
        </div>
      </div>

      {/* Static thumbnail for layout - invisible but maintains space */}
      <div 
        className={cn(
          "relative rounded-md overflow-hidden bg-secondary shadow-lg invisible",
          aspectRatioClasses[cardStyle]
        )}
      >
        <img
          src={content.thumbnailUrl}
          alt={content.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Title below card - for non-hover state */}
      {cardStyle !== "backdrop" && cardStyle !== "wide" && (
        <div className={cn(
          "mt-2 px-0.5 transition-opacity",
          isHovered ? "opacity-0" : "opacity-100"
        )}>
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
