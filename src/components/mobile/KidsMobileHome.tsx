import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsMobileContentCard } from "./KidsMobileContentCard";
import { KidsHeroCarousel } from "./KidsHeroCarousel";
import { Film, Tv, Clock, Moon, TrendingUp, Sparkles, ChevronRight } from "lucide-react";
import { useKidsTimeLimit } from "@/hooks/useKidsTimeLimit";
import { useBedtimeMode } from "@/hooks/useBedtimeMode";
import { useProfileContext } from "@/contexts/ProfileContext";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT } from "@/constants/kidsRatings";
import { KidsMobileYouTubeRow } from "@/components/kids/KidsMobileYouTubeRow";
import { KidsYouTubePlayer } from "@/components/kids/KidsYouTubePlayer";
import { useState } from "react";

interface KidsMobileHomeProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

const SectionHeader = ({ 
  icon: Icon, 
  title, 
  color,
  onSeeAll
}: { 
  icon: typeof Film; 
  title: string; 
  color: string;
  onSeeAll?: () => void;
}) => (
  <div className="flex items-center justify-between px-5 mb-4">
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="h-4 w-4 text-white" strokeWidth={2} />
      </div>
      <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">{title}</h2>
    </div>
    {onSeeAll && (
      <button 
        onClick={onSeeAll}
        className="flex items-center gap-1 text-xs text-white/60 active:scale-95 transition-transform"
      >
        <span>See All</span>
        <ChevronRight className="h-3 w-3" />
      </button>
    )}
  </div>
);

export const KidsMobileHome = ({ onPlay, onDetails }: KidsMobileHomeProps) => {
  const navigate = useNavigate();
  const { currentProfile } = useProfileContext();
  const { timeRemaining, isTimeLimitReached } = useKidsTimeLimit();
  const { isBedtime, bedtimeTime } = useBedtimeMode();
  const [youtubePlayer, setYoutubePlayer] = useState<{ videoId: string; title: string } | null>(null);

  const handlePlayYouTubeVideo = (videoId: string, title: string) => {
    setYoutubePlayer({ videoId, title });
  };

  const { data: kidsContent = [], isLoading } = useQuery({
    queryKey: ["kids-content-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .in("content_rating", KIDS_RATINGS)
        .or(`age_limit.is.null,age_limit.lte.${KIDS_MAX_AGE_LIMIT}`)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Additional client-side filter to ensure strict age compliance
      return (data || [])
        .filter((item: any) => !item.age_limit || item.age_limit <= KIDS_MAX_AGE_LIMIT)
        .map((item: any) => ({
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
        })) as Content[];
    },
  });

  // Prioritize animation content
  const animationContent = kidsContent.filter((c) => 
    c.genre?.toLowerCase().includes("animation") || 
    c.genre?.toLowerCase().includes("animated") ||
    c.genre?.toLowerCase().includes("cartoon")
  );
  const nonAnimationContent = kidsContent.filter((c) => 
    !c.genre?.toLowerCase().includes("animation") && 
    !c.genre?.toLowerCase().includes("animated") &&
    !c.genre?.toLowerCase().includes("cartoon")
  );
  
  // Sort content with animation first
  const sortedContent = [...animationContent, ...nonAnimationContent];
  
  const movies = kidsContent.filter((c) => c.contentType === "movie");
  const shows = kidsContent.filter((c) => c.contentType === "series");

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
      <div className="space-y-8 pt-4">
        <div className="px-5">
          <Skeleton className="h-48 w-full rounded-3xl bg-white/[0.04]" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <div className="px-5 flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-xl bg-white/[0.04]" />
              <Skeleton className="w-24 h-5 bg-white/[0.04]" />
            </div>
            <div className="flex gap-3 px-5">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="w-[120px] aspect-[2/3] rounded-2xl bg-white/[0.04]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // YouTube player modal
  if (youtubePlayer) {
    return (
      <KidsYouTubePlayer
        videoId={youtubePlayer.videoId}
        title={youtubePlayer.title}
        onClose={() => setYoutubePlayer(null)}
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
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

      {/* Animation Section - Featured First */}
      {animationContent.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-gradient-to-br from-fuchsia-500/20 via-fuchsia-500/10 to-purple-500/20 rounded-xl mx-3 py-4 border border-fuchsia-500/20"
        >
          <SectionHeader 
            icon={Sparkles} 
            title="Animation" 
            color="bg-gradient-to-br from-fuchsia-500 to-purple-600"
            onSeeAll={() => navigate("/genres")} 
          />
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {animationContent.slice(0, 8).map((item, index) => (
              <KidsMobileContentCard
                key={item.id}
                content={item}
                onPlay={onPlay}
                onDetails={onDetails}
                index={index}
                variant="large"
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* Trending Now */}
      {kidsContent.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-pink-500/20 rounded-xl mx-3 py-4 border border-rose-500/20"
        >
          <SectionHeader 
            icon={TrendingUp} 
            title="Trending Now" 
            color="bg-gradient-to-br from-rose-500 to-pink-600"
            onSeeAll={() => navigate("/genres")} 
          />
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {sortedContent.slice(0, 8).map((item, index) => (
              <KidsMobileContentCard
                key={item.id}
                content={item}
                onPlay={onPlay}
                onDetails={onDetails}
                index={index}
                variant="large"
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* YouTube Videos */}
      <KidsMobileYouTubeRow onPlayVideo={handlePlayYouTubeVideo} />

      {/* Movies */}
      {movies.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-cyan-500/20 rounded-xl mx-3 py-4 border border-blue-500/20"
        >
          <SectionHeader 
            icon={Film} 
            title="Movies" 
            color="bg-gradient-to-br from-blue-500 to-cyan-600"
            onSeeAll={() => navigate("/genres")} 
          />
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {movies.slice(0, 12).map((item, index) => (
              <KidsMobileContentCard
                key={item.id}
                content={item}
                onPlay={onPlay}
                onDetails={onDetails}
                index={index}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* TV Shows */}
      {shows.length > 0 && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-green-500/20 rounded-xl mx-3 py-4 border border-emerald-500/20"
        >
          <SectionHeader 
            icon={Tv} 
            title="TV Shows" 
            color="bg-gradient-to-br from-emerald-500 to-green-600"
            onSeeAll={() => navigate("/genres")} 
          />
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {shows.slice(0, 12).map((item, index) => (
              <KidsMobileContentCard
                key={item.id}
                content={item}
                onPlay={onPlay}
                onDetails={onDetails}
                index={index}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* Empty State */}
      {kidsContent.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-8 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-6">
            <Film className="h-10 w-10 text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2 tracking-[-0.02em]">No Shows Yet</h2>
          <p className="text-[15px] text-white/50 font-medium">Check back soon for fun content!</p>
        </div>
      )}
    </div>
  );
};