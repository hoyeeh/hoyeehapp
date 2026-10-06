import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsHeroCarousel } from "./KidsHeroCarousel";
import { Film, Clock, Moon } from "lucide-react";
import { useKidsTimeLimit } from "@/hooks/useKidsTimeLimit";
import { useBedtimeMode } from "@/hooks/useBedtimeMode";
import { useProfileContext } from "@/contexts/ProfileContext";
import { motion } from "framer-motion";
import { KIDS_RATINGS, isKidsContentAllowed } from "@/constants/kidsRatings";
import { KidsMobileYouTubeRow } from "@/components/kids/KidsMobileYouTubeRow";
import { KidsEnhancedYouTubePlayer } from "@/components/kids/KidsEnhancedYouTubePlayer";
import { KidsLoadingAnimation } from "@/components/kids/KidsLoadingAnimation";
import { KidsDynamicSections } from "@/components/kids/KidsDynamicSections";
import { useKidsApprovedContent, useKidsProfileRequiresApproval } from "@/hooks/useKidsApprovedContent";
import { KidsParentalSetupNotice } from "@/components/kids/KidsParentalSetupNotice";
import { useState, useEffect, useRef } from "react";
import { useRealtimeHomeSections } from "@/hooks/useRealtimeHomeSections";

interface KidsMobileHomeProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}


export const KidsMobileHome = ({ onPlay, onDetails }: KidsMobileHomeProps) => {
  const navigate = useNavigate();
  const { currentProfile } = useProfileContext();
  const { timeRemaining, isTimeLimitReached } = useKidsTimeLimit();
  const { isBedtime, bedtimeTime } = useBedtimeMode();
  const [youtubePlayer, setYoutubePlayer] = useState<{ videoId: string; title: string } | null>(null);
  useRealtimeHomeSections();

  // Get parental approval settings
  const { isContentApproved } = useKidsApprovedContent(currentProfile?.id);
  const { requiresApproval } = useKidsProfileRequiresApproval(currentProfile?.id);

  const handlePlayYouTubeVideo = (videoId: string, title: string) => {
    setYoutubePlayer({ videoId, title });
  };

  const { data: kidsContent = [], isLoading } = useQuery({
    queryKey: ["kids-content-mobile", currentProfile?.id],
    queryFn: async () => {
      // Query kids content - filter by rating only at DB level
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .in("content_rating", KIDS_RATINGS)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Strict client-side filtering for kids compliance
      const filtered = (data || []).filter((item: any) =>
        isKidsContentAllowed(item) && Boolean(item.video_url)
      );

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

  // Prioritize animation content for hero
  const animationContent = displayContent.filter((c) => 
    c.genre?.toLowerCase().includes("animation") || 
    c.genre?.toLowerCase().includes("animated") ||
    c.genre?.toLowerCase().includes("cartoon")
  );
  const nonAnimationContent = displayContent.filter((c) => 
    !c.genre?.toLowerCase().includes("animation") && 
    !c.genre?.toLowerCase().includes("animated") &&
    !c.genre?.toLowerCase().includes("cartoon")
  );
  
  // Sort content with animation first for hero
  const sortedContent = [...animationContent, ...nonAnimationContent];

  // Bedtime screen
  if (isBedtime) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-8"
        >
          <Moon className="h-12 w-12 text-white" strokeWidth={1.5} />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-white mb-3 tracking-[-0.02em]"
        >
          Time for Bed
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-[15px] text-white/50 mb-6 font-medium"
        >
          Rest up for more adventures tomorrow!
        </motion.p>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 text-white/30 text-[13px] font-medium"
        >
          <Clock className="h-4 w-4" strokeWidth={2} />
          <span>Bedtime is {bedtimeTime?.slice(0, 5)}</span>
        </motion.div>
      </div>
    );
  }

  // Time limit reached
  if (isTimeLimitReached) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-8"
        >
          <Clock className="h-12 w-12 text-white" strokeWidth={1.5} />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-3 tracking-[-0.02em]">All Done for Today</h1>
        <p className="text-[15px] text-white/50 font-medium">
          Come back tomorrow for more fun!
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 pt-4">
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
    <div className="space-y-8 pb-10">

      {/* Parental Setup Notice */}
      <KidsParentalSetupNotice />

      {/* Hero Carousel - prioritize animation */}
      <KidsHeroCarousel 
        content={sortedContent} 
        onPlay={onPlay} 
        onDetails={onDetails} 
      />

      {/* Time Remaining Badge */}
      {timeRemaining !== null && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-5 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-500/20 border border-violet-500/20"
        >
          <Clock className="h-4 w-4 text-violet-400" strokeWidth={2} />
          <span className="text-[13px] text-violet-300 font-semibold">
            {timeRemaining} min left today
          </span>
        </motion.div>
      )}

      {/* Kids layout is owned entirely by the dedicated admin surface. */}
      <KidsDynamicSections 
        allContent={displayContent} 
        excludedContentIds={sortedContent[0] ? [sortedContent[0].id] : []}
        onPlay={onPlay} 
        onDetails={onDetails}
        onPlayVideo={handlePlayYouTubeVideo}
      />

      {/* Empty State */}
      {displayContent.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-8 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-6">
            <Film className="h-10 w-10 text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2 tracking-[-0.02em]">No Shows Yet</h2>
          <p className="text-[15px] text-white/50 font-medium">
            {requiresApproval 
              ? "Ask a parent to approve some content!" 
              : "Check back soon for fun content!"}
          </p>
        </div>
      )}
    </div>
  );
};