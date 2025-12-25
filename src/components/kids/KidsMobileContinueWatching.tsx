import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsMobileContentCard } from "@/components/mobile/KidsMobileContentCard";
import { Play } from "lucide-react";
import { motion } from "framer-motion";
import { useProfileContext } from "@/contexts/ProfileContext";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT, isBlockedTitle, isKidsAllowedGenre } from "@/constants/kidsRatings";

interface KidsMobileContinueWatchingProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

export const KidsMobileContinueWatching = ({ onPlay, onDetails }: KidsMobileContinueWatchingProps) => {
  const { currentProfile } = useProfileContext();

  const { data: continueWatching = [] } = useQuery({
    queryKey: ["kids-continue-watching-mobile", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile?.id) return [];

      const { data: progressData, error: progressError } = await supabase
        .from("kids_viewing_history")
        .select(`
          content_id,
          duration_watched_minutes,
          completed,
          watched_at,
          content:content_id(*)
        `)
        .eq("profile_id", currentProfile.id)
        .eq("completed", false)
        .order("watched_at", { ascending: false })
        .limit(10);

      if (progressError) throw progressError;
      if (!progressData?.length) return [];

      return progressData
        .filter((item: any) => item.content)
        .filter((item: any) => KIDS_RATINGS.includes(item.content.content_rating))
        .filter((item: any) => !item.content.age_limit || item.content.age_limit <= KIDS_MAX_AGE_LIMIT)
        .filter((item: any) => !isBlockedTitle(item.content.title || ""))
        .filter((item: any) => isKidsAllowedGenre(item.content.genre))
        .map((item: any) => ({
          id: item.content.id,
          title: item.content.title,
          description: item.content.description || "",
          thumbnailUrl: item.content.thumbnail_url || "",
          videoUrl: item.content.video_url || "",
          genre: item.content.genre || "",
          contentType: item.content.content_type as "movie" | "series",
          isPremium: item.content.is_premium || false,
          duration: item.content.duration || 0,
          year: item.content.year,
          contentRating: item.content.content_rating,
          watchProgress: item.duration_watched_minutes,
        })) as (Content & { watchProgress?: number })[];
    },
    enabled: !!currentProfile?.id,
  });

  if (continueWatching.length === 0) return null;

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-orange-500/20 rounded-xl mx-3 py-4 border border-amber-500/20"
    >
      <div className="flex items-center gap-2.5 px-5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Play className="h-4 w-4 text-white" fill="white" strokeWidth={0} />
        </div>
        <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">Continue Watching</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
        {continueWatching.slice(0, 8).map((item, index) => (
          <div key={item.id} className="relative flex-shrink-0">
            <KidsMobileContentCard
              content={item}
              onPlay={onPlay}
              onDetails={onDetails}
              index={index}
              variant="large"
            />
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40 rounded-b-xl overflow-hidden">
              <div 
                className="h-full bg-amber-500" 
                style={{ width: `${Math.min((item.watchProgress || 0) / (item.duration || 1) * 100, 95)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
};