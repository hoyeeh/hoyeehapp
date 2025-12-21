import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { Play, Info, Plus, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/useDatabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// Storage key for persistent random banner index
const DESKTOP_BANNER_KEY = "hoyeeh-desktop-banner";
const BANNER_EXPIRY = 6 * 60 * 60 * 1000; // 6 hours

interface EnhancedHeroBannerProps {
  fallbackContent?: Content;
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

export const EnhancedHeroBanner = ({
  fallbackContent,
  onPlay,
  onDetails,
}: EnhancedHeroBannerProps) => {
  const [currentIndex, setCurrentIndex] = useState(() => {
    try {
      const stored = localStorage.getItem(DESKTOP_BANNER_KEY);
      if (stored) {
        const { index, timestamp } = JSON.parse(stored);
        if (Date.now() - timestamp < BANNER_EXPIRY) {
          return index;
        }
      }
    } catch {}
    return 0;
  });
  const [isHovering, setIsHovering] = useState(false);
  const hasInitialized = useRef(false);
  
  const { data: watchlistIds = [] } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

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

  // Initialize random banner on first load
  useEffect(() => {
    if (banners.length <= 1 || hasInitialized.current) return;
    
    try {
      const stored = localStorage.getItem(DESKTOP_BANNER_KEY);
      if (!stored || Date.now() - JSON.parse(stored).timestamp >= BANNER_EXPIRY) {
        const randomIndex = Math.floor(Math.random() * banners.length);
        setCurrentIndex(randomIndex);
        localStorage.setItem(DESKTOP_BANNER_KEY, JSON.stringify({ index: randomIndex, timestamp: Date.now() }));
      }
    } catch {}
    
    hasInitialized.current = true;
  }, [banners.length]);

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const newIndex = (prev + 1) % banners.length;
        try {
          localStorage.setItem(DESKTOP_BANNER_KEY, JSON.stringify({ index: newIndex, timestamp: Date.now() }));
        } catch {}
        return newIndex;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [banners.length]);

  const displayTitle = activeBanner?.title || content?.title;
  const displaySubtitle = activeBanner?.subtitle;
  const displayDescription = activeBanner?.description || content?.description;
  const displayImage = activeBanner?.image_url || content?.thumbnailUrl;
  const ctaText = activeBanner?.cta_text || "Play";

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  if (!content && !activeBanner) return null;

  const isInList = content ? watchlistIds.includes(content.id) : false;

  const handleToggleList = async () => {
    if (!content) return;
    try {
      if (isInList) {
        await removeFromWatchlist.mutateAsync(content.id);
        toast.success("Removed from My List");
      } else {
        await addToWatchlist.mutateAsync(content.id);
        toast.success("Added to My List");
      }
    } catch (error) {
      toast.error("Failed to update watchlist");
    }
  };

  // Animation variants
  const contentVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.8, 
        ease: "easeOut" as const
      }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { duration: 0.4 }
    }
  };

  const staggerChildren = {
    visible: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const childVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" as const }
    }
  };

  return (
    <div 
      className="relative h-[70vh] md:h-[85vh] w-full overflow-hidden bg-background"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Background with smooth transition - Image Only */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img
            src={displayImage}
            alt={displayTitle}
            className="w-full h-full object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Apple-style gradient overlays - subtle and refined */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-90" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent" />

      {/* Content with AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentIndex}
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="absolute inset-0 flex items-end"
        >
          <motion.div 
            variants={staggerChildren}
            initial="hidden"
            animate="visible"
            className="container mx-auto px-6 md:px-16 pb-20 md:pb-32 max-w-5xl"
          >
            {/* Subtitle - Apple-style uppercase tracking */}
            {displaySubtitle && (
              <motion.p 
                variants={childVariants}
                className="text-primary font-semibold text-xs md:text-sm mb-3 tracking-[0.2em] uppercase"
              >
                {displaySubtitle}
              </motion.p>
            )}

            {/* Title - Apple-style large, bold, tight tracking */}
            <motion.h1 
              variants={childVariants}
              className="font-bold text-4xl md:text-6xl lg:text-7xl mb-4 leading-[0.95] tracking-[-0.03em] text-foreground"
            >
              {displayTitle}
            </motion.h1>

            {/* Meta Info - Glass morphism pill style */}
            {content && (
              <motion.div 
                variants={childVariants}
                className="flex flex-wrap items-center gap-2 md:gap-3 mb-5"
              >
                {content.year && (
                  <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-sm font-medium text-foreground/90">
                    {content.year}
                  </span>
                )}
                {content.rating && (
                  <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-sm font-medium text-foreground/90">
                    {content.rating}
                  </span>
                )}
                {content.duration && (
                  <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-sm font-medium text-foreground/90">
                    {Math.floor(content.duration / 3600)}h {Math.floor((content.duration % 3600) / 60)}m
                  </span>
                )}
                <span className="px-3 py-1 rounded-full bg-primary/20 backdrop-blur-sm text-sm font-semibold text-primary capitalize">
                  {content.contentType}
                </span>
                {content.genre && (
                  <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-sm font-medium text-foreground/90">
                    {content.genre}
                  </span>
                )}
              </motion.div>
            )}

            {/* Description - Clean, refined typography */}
            <motion.p 
              variants={childVariants}
              className="text-sm md:text-base text-foreground/70 mb-8 line-clamp-2 max-w-xl leading-relaxed font-normal"
            >
              {displayDescription}
            </motion.p>

            {/* Action Buttons - Apple-style */}
            <motion.div 
              variants={childVariants}
              className="flex flex-wrap items-center gap-3"
            >
              {content && (
                <>
                  {/* Primary Button - White, clean */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onPlay(content)}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl shadow-lg shadow-black/20 hover:bg-white/95 transition-colors"
                  >
                    <Play className="h-5 w-5" fill="currentColor" />
                    <span>{ctaText}</span>
                  </motion.button>

                  {/* Secondary Button - Glass morphism */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onDetails(content)}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md text-foreground font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
                  >
                    <Info className="h-5 w-5" />
                    <span>More Info</span>
                  </motion.button>

                  {/* Tertiary Button - Glass with subtle border */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleToggleList}
                    className={cn(
                      "flex items-center gap-2 px-5 py-3 rounded-xl border backdrop-blur-md transition-colors",
                      isInList 
                        ? "bg-primary/20 border-primary/30 text-primary" 
                        : "bg-white/10 border-white/20 text-foreground hover:bg-white/20"
                    )}
                  >
                    {isInList ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                    <span className="hidden md:inline">{isInList ? "In My List" : "My List"}</span>
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls - Visible on Hover */}
      {banners.length > 1 && (
        <>
          {/* Navigation Arrows */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovering ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 backdrop-blur-md border border-white/10 hover:bg-black/50 transition-colors"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </motion.button>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovering ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/30 backdrop-blur-md border border-white/10 hover:bg-black/50 transition-colors"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </motion.button>

          {/* Dot Indicators */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovering ? 1 : 0.5 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-8 right-8 flex items-center gap-2"
          >
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  index === currentIndex 
                    ? "bg-white w-6" 
                    : "bg-white/40 hover:bg-white/60"
                )}
              />
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
};
