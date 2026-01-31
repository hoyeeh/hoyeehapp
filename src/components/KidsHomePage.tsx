import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsContentCard } from "./KidsContentCard";
import { Clock, Moon, Film, Tv, TrendingUp, Play, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useKidsTimeLimit } from "@/hooks/useKidsTimeLimit";
import { useBedtimeMode } from "@/hooks/useBedtimeMode";
import { useProfileContext } from "@/contexts/ProfileContext";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT, isBlockedTitle, isKidsAllowedGenre } from "@/constants/kidsRatings";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KidsYouTubeRow } from "./kids/KidsYouTubeRow";
import { KidsEnhancedYouTubePlayer } from "./kids/KidsEnhancedYouTubePlayer";
import { KidsLoadingAnimation } from "./kids/KidsLoadingAnimation";
import { KidsConfetti } from "./kids/KidsConfetti";
import { KidsContinueWatching } from "./kids/KidsContinueWatching";
import { KidsAgeGroupSections } from "./kids/KidsAgeGroupSections";
import { useKidsApprovedContent, useKidsProfileRequiresApproval } from "@/hooks/useKidsApprovedContent";
import { KidsParentalSetupNotice } from "./kids/KidsParentalSetupNotice";
import { KidsDesktopDynamicSections } from "./kids/KidsDesktopDynamicSections";

interface KidsHomePageProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

const SectionHeader = ({ 
  icon: Icon, 
  title, 
  color 
}: { 
  icon: typeof Film; 
  title: string; 
  color: string;
}) => (
  <div className="flex items-center gap-3 mb-6">
    <div className={`w-10 h-10 rounded-2xl ${color} flex items-center justify-center shadow-lg`}>
      <Icon className="h-5 w-5 text-white" strokeWidth={2} />
    </div>
    <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">{title}</h2>
  </div>
);

// Hero Carousel Component for Desktop
const HeroCarousel = ({ 
  content, 
  onPlay, 
  onDetails 
}: { 
  content: Content[]; 
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const featuredContent = content.slice(0, 5);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % featuredContent.length);
  }, [featuredContent.length]);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + featuredContent.length) % featuredContent.length);
  };

  useEffect(() => {
    if (featuredContent.length <= 1) return;
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [nextSlide, featuredContent.length]);

  if (featuredContent.length === 0) return null;

  const current = featuredContent[currentIndex];

  return (
    <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#1a1a2e] to-[#16162a] aspect-[21/9]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute inset-0"
        >
          <img
            src={current.thumbnailUrl}
            alt={current.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0F]/90 via-[#0A0A0F]/30 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="absolute inset-0 flex items-end p-10">
        <motion.div
          key={currentIndex + "-content"}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="max-w-xl"
        >
          {current.contentRating && (
            <span className="inline-block px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-xs font-semibold text-white/80 mb-4">
              {current.contentRating}
            </span>
          )}
          <h2 className="text-4xl font-bold text-white tracking-[-0.02em] mb-3">
            {current.title}
          </h2>
          <p className="text-[15px] text-white/60 line-clamp-2 mb-6 font-medium leading-relaxed">
            {current.description}
          </p>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPlay(current)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white text-[#0A0A0F] text-[14px] font-semibold shadow-lg hover:shadow-xl transition-shadow"
            >
              <Play className="h-5 w-5" fill="currentColor" strokeWidth={0} />
              Play Now
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onDetails(current)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm text-white text-[14px] font-semibold border border-white/10 hover:bg-white/15 transition-colors"
            >
              More Info
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Navigation Arrows */}
      {featuredContent.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2} />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
          >
            <ChevronRight className="h-6 w-6" strokeWidth={2} />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {featuredContent.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {featuredContent.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? "w-8 bg-white" 
                  : "w-2 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const KidsHomePage = ({ onPlay, onDetails }: KidsHomePageProps) => {
  const { currentProfile } = useProfileContext();
  const { timeRemaining, isTimeLimitReached } = useKidsTimeLimit();
  const { isBedtime, bedtimeTime } = useBedtimeMode();
  const [youtubePlayer, setYoutubePlayer] = useState<{ videoId: string; title: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const hasShownConfetti = useRef(false);

  // Get parental approval settings
  const { approvedContent, isContentApproved } = useKidsApprovedContent(currentProfile?.id);
  const { requiresApproval } = useKidsProfileRequiresApproval(currentProfile?.id);

  const handlePlayYouTubeVideo = (videoId: string, title: string) => {
    setYoutubePlayer({ videoId, title });
  };

  const { data: kidsContent = [], isLoading } = useQuery({
    queryKey: ["kids-content-desktop", currentProfile?.id],
    queryFn: async () => {
      // Build query for kids content with proper AND logic
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .in("content_rating", KIDS_RATINGS)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Client-side filtering for strict kids content compliance
      let filtered = (data || [])
        // Age limit filter
        .filter((item: any) => !item.age_limit || item.age_limit <= KIDS_MAX_AGE_LIMIT)
        // Block specific titles
        .filter((item: any) => !isBlockedTitle(item.title || ""))
        // Genre filter - ONLY Animation and Family
        .filter((item: any) => isKidsAllowedGenre(item.genre));

      // Map to Content type with age_limit included
      return filtered.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description || "",
        thumbnailUrl: item.thumbnail_url || "",
        videoUrl: item.video_url || "",
        genre: item.genre || "",
        contentType: item.content_type as "movie" | "series",
        isPremium: item.is_premium || false,
        duration: item.duration || 0,
        year: item.year,
        contentRating: item.content_rating,
        age_limit: item.age_limit,
      })) as Content[];
    },
  });

  // Apply parental approval filter if enabled
  const displayContent = requiresApproval 
    ? kidsContent.filter(c => isContentApproved(c.id))
    : kidsContent;

  // Note: Animation content, movies, shows filtering now handled by KidsDesktopDynamicSections

  // Trigger confetti when content loads - MUST be before any conditional returns
  useEffect(() => {
    if (!isLoading && displayContent.length > 0 && !hasShownConfetti.current) {
      hasShownConfetti.current = true;
      setShowConfetti(true);
      // Hide confetti after animation
      const timer = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, displayContent.length]);

  // Bedtime screen
  if (isBedtime) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-8">
        <div className="text-center max-w-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-28 h-28 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-purple-500/30"
          >
            <Moon className="h-14 w-14 text-white" strokeWidth={1.5} />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold text-white mb-4 tracking-[-0.02em]"
          >
            Time for Bed
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[17px] text-white/50 mb-6 font-medium"
          >
            Rest up for more adventures tomorrow!
          </motion.p>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-2 text-white/30 text-[15px] font-medium"
          >
            <Clock className="h-5 w-5" strokeWidth={2} />
            <span>Bedtime is {bedtimeTime?.slice(0, 5)}</span>
          </motion.div>
        </div>
      </div>
    );
  }

  // Time limit reached
  if (isTimeLimitReached) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-8">
        <div className="text-center max-w-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-28 h-28 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-orange-500/30"
          >
            <Clock className="h-14 w-14 text-white" strokeWidth={1.5} />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-4 tracking-[-0.02em]">All Done for Today</h1>
          <p className="text-[17px] text-white/50 font-medium">
            Come back tomorrow for more fun!
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6">
        <KidsLoadingAnimation message="Loading fun stuff..." />
      </div>
    );
  }

  // YouTube player modal
  if (youtubePlayer) {
    return (
      <KidsEnhancedYouTubePlayer
        videoId={youtubePlayer.videoId}
        title={youtubePlayer.title}
        onClose={() => setYoutubePlayer(null)}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 space-y-10 pb-12">
      {/* Confetti celebration when content loads */}
      <KidsConfetti show={showConfetti} />

      {/* Parental Setup Notice */}
      <KidsParentalSetupNotice />

      {/* Hero Carousel - prioritize animation */}
      <HeroCarousel content={displayContent} onPlay={onPlay} onDetails={onDetails} />

      {/* Time Remaining Badge */}
      {timeRemaining !== null && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-violet-500/15 border border-violet-500/20 max-w-md mx-auto"
        >
          <Clock className="h-5 w-5 text-violet-400" strokeWidth={2} />
          <span className="text-[14px] text-violet-300 font-semibold">
            {timeRemaining} minutes left today
          </span>
        </motion.div>
      )}

      {/* Continue Watching */}
      <KidsContinueWatching onPlay={onPlay} onDetails={onDetails} />

      {/* Age Group Sections */}
      <KidsAgeGroupSections content={displayContent} onPlay={onPlay} onDetails={onDetails} />

      {/* Dynamic Sections from Admin (show_on_kids=true) */}
      <KidsDesktopDynamicSections 
        allContent={displayContent}
        onPlay={onPlay}
        onDetails={onDetails}
        onPlayVideo={handlePlayYouTubeVideo}
      />

      {/* Empty State */}
      {displayContent.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-8 text-center">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-8 shadow-2xl shadow-violet-500/30">
            <Film className="h-12 w-12 text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3 tracking-[-0.02em]">No Shows Yet</h2>
          <p className="text-[15px] text-white/50 font-medium">
            {requiresApproval 
              ? "Ask a parent to approve some content for you!" 
              : "Check back soon for fun cartoons and family shows!"}
          </p>
        </div>
      )}
    </div>
  );
};