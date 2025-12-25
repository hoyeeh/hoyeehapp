import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsContentCard } from "@/components/KidsContentCard";
import { Play, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useProfileContext } from "@/contexts/ProfileContext";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT, isBlockedTitle, isKidsAllowedGenre } from "@/constants/kidsRatings";

interface KidsContinueWatchingProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

export const KidsContinueWatching = ({ onPlay, onDetails }: KidsContinueWatchingProps) => {
  const { currentProfile } = useProfileContext();

  const { data: continueWatching = [] } = useQuery({
    queryKey: ["kids-continue-watching", currentProfile?.id],
    queryFn: async () => {
      if (!currentProfile?.id) return [];

      // Get watch progress for this profile
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
        .limit(12);

      if (progressError) throw progressError;
      if (!progressData?.length) return [];

      // Filter for kids-appropriate content with proper genre
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
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-orange-500/20 rounded-2xl p-4 md:p-6 border border-amber-500/20"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <Play className="h-5 w-5 text-white" fill="white" strokeWidth={0} />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">Continue Watching</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {continueWatching.slice(0, 6).map((item, index) => (
          <div key={item.id} className="relative">
            <KidsContentCard
              content={item}
              onPlay={onPlay}
              onDetails={onDetails}
              index={index}
            />
            {/* Progress bar overlay */}
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