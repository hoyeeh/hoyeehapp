import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { Play, Info, Plus, Check, Volume2, VolumeX, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EnhancedHeroBannerProps {
  fallbackContent?: Content;
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
  onToggleList: (content: Content) => void;
  isInList: boolean;
}

export const EnhancedHeroBanner = ({
  fallbackContent,
  onPlay,
  onDetails,
  onToggleList,
  isInList,
}: EnhancedHeroBannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Fetch active hero banners
  const { data: banners = [] } = useQuery({
    queryKey: ["hero-banners"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("hero_banners")
        .select(`
          *,
          content:content_id (
            id, title, description, thumbnail_url, video_url, genre, content_type, is_premium, duration, year
          )
        `)
        .eq("is_active", true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Transform banner content to proper Content type
  const transformContent = (raw: any): Content | undefined => {
    if (!raw) return undefined;
    return {
      id: raw.id,
      title: raw.title,
      description: raw.description || "",
      thumbnailUrl: raw.thumbnail_url || "",
      videoUrl: raw.video_url || "",
      genre: raw.genre || "",
      contentType: raw.content_type as "movie" | "series",
      isPremium: raw.is_premium || false,
      duration: raw.duration || 0,
      year: raw.year,
      rating: raw.rating,
    };
  };

  // Use banners if available, otherwise fallback to content
  const activeBanner = banners[currentIndex];
  const bannerContent = activeBanner?.content ? transformContent(activeBanner.content) : undefined;
  const content = bannerContent || fallbackContent;

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [banners.length]);

  // Handle video playback
  useEffect(() => {
    if (activeBanner?.video_url && videoRef.current) {
      videoRef.current.play().then(() => {
        setIsVideoPlaying(true);
      }).catch(() => {
        setIsVideoPlaying(false);
      });
    } else {
      setIsVideoPlaying(false);
    }
  }, [activeBanner?.video_url, currentIndex]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  if (!content && !activeBanner) return null;

  const displayTitle = activeBanner?.title || content?.title;
  const displaySubtitle = activeBanner?.subtitle;
  const displayDescription = activeBanner?.description || content?.description;
  const displayImage = activeBanner?.image_url || content?.thumbnailUrl;
  const displayVideo = activeBanner?.video_url;
  const ctaText = activeBanner?.cta_text || "Watch Now";

  return (
    <div className="relative h-[70vh] md:h-[85vh] w-full overflow-hidden">
      {/* Background Video or Image */}
      <div className="absolute inset-0">
        {displayVideo ? (
          <video
            ref={videoRef}
            src={displayVideo}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted={isMuted}
            playsInline
          />
        ) : (
          <img
            src={displayImage}
            alt={displayTitle}
            className="w-full h-full object-cover animate-scale-in"
          />
        )}

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex items-center">
        <div className="container mx-auto px-4 md:px-12 max-w-3xl">
          {/* Subtitle */}
          {displaySubtitle && (
            <p className="text-brand font-semibold text-sm md:text-base mb-2 animate-fade-in">
              {displaySubtitle}
            </p>
          )}

          {/* Title */}
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl mb-4 animate-fade-in leading-tight">
            {displayTitle}
          </h1>

          {/* Meta Info */}
          {content && (
            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm md:text-base text-muted-foreground mb-4 animate-fade-in">
              {content.year && <span>{content.year}</span>}
              {content.rating && (
                <span className="border border-muted-foreground/30 px-2 py-0.5 rounded">
                  {content.rating}
                </span>
              )}
              {content.duration && (
                <span>
                  {Math.floor(content.duration / 3600)}h{" "}
                  {Math.floor((content.duration % 3600) / 60)}m
                </span>
              )}
              <span className="text-brand capitalize">{content.contentType}</span>
              {content.genre && <span>{content.genre}</span>}
            </div>
          )}

          {/* Description */}
          <p className="text-base md:text-lg text-muted-foreground mb-6 line-clamp-3 max-w-2xl animate-fade-in">
            {displayDescription}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 animate-fade-in">
            {content && (
              <>
                <Button
                  size="lg"
                  variant="brand"
                  onClick={() => onPlay(content)}
                  className="gap-2 text-base px-8 shadow-lg shadow-brand/30"
                >
                  <Play className="h-5 w-5" fill="currentColor" />
                  {ctaText}
                </Button>

                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => onDetails(content)}
                  className="gap-2 text-base"
                >
                  <Info className="h-5 w-5" />
                  More Info
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => onToggleList(content)}
                  className="gap-2"
                >
                  {isInList ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                  My List
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Video Controls */}
      {displayVideo && isVideoPlaying && (
        <button
          onClick={toggleMute}
          className="absolute bottom-8 right-8 w-12 h-12 rounded-full bg-background/50 border border-border flex items-center justify-center hover:bg-background/70 transition-colors"
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </button>
      )}

      {/* Banner Navigation */}
      {banners.length > 1 && (
        <>
          {/* Navigation Arrows */}
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/50 flex items-center justify-center hover:bg-background/70 transition-colors opacity-0 hover:opacity-100 md:opacity-50"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/50 flex items-center justify-center hover:bg-background/70 transition-colors opacity-0 hover:opacity-100 md:opacity-50"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentIndex
                    ? "w-8 bg-brand"
                    : "bg-foreground/30 hover:bg-foreground/50"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
