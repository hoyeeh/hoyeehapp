import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsMobileContentCard } from "./KidsMobileContentCard";
import { KidsHeroCarousel } from "./KidsHeroCarousel";
import { Film, Tv, Clock, Moon, TrendingUp } from "lucide-react";
import { useKidsTimeLimit } from "@/hooks/useKidsTimeLimit";
import { useBedtimeMode } from "@/hooks/useBedtimeMode";
import { useProfileContext } from "@/contexts/ProfileContext";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { KIDS_RATINGS } from "@/constants/kidsRatings";

interface KidsMobileHomeProps {
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
  <div className="flex items-center gap-2.5 px-5 mb-4">
    <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center`}>
      <Icon className="h-4 w-4 text-white" strokeWidth={2} />
    </div>
    <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">{title}</h2>
  </div>
);

export const KidsMobileHome = ({ onPlay, onDetails }: KidsMobileHomeProps) => {
  const { currentProfile } = useProfileContext();
  const { timeRemaining, isTimeLimitReached } = useKidsTimeLimit();
  const { isBedtime, bedtimeTime } = useBedtimeMode();

  const { data: kidsContent = [], isLoading } = useQuery({
    queryKey: ["kids-content-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .in("content_rating", KIDS_RATINGS)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map((item: any) => ({
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

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Carousel */}
      <KidsHeroCarousel 
        content={kidsContent} 
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

      {/* Trending Now */}
      {kidsContent.length > 0 && (
        <section>
          <SectionHeader icon={TrendingUp} title="Trending Now" color="bg-gradient-to-br from-rose-500 to-pink-600" />
          <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
            {kidsContent.slice(0, 8).map((item, index) => (
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
        </section>
      )}

      {/* Movies */}
      {movies.length > 0 && (
        <section>
          <SectionHeader icon={Film} title="Movies" color="bg-gradient-to-br from-blue-500 to-cyan-600" />
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
        </section>
      )}

      {/* TV Shows */}
      {shows.length > 0 && (
        <section>
          <SectionHeader icon={Tv} title="TV Shows" color="bg-gradient-to-br from-emerald-500 to-green-600" />
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
        </section>
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