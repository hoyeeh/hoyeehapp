import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsMobileContentCard } from "./KidsMobileContentCard";
import { Heart, Film } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT, isBlockedTitle } from "@/constants/kidsRatings";

interface KidsMobileMyListProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

export const KidsMobileMyList = ({ onPlay, onDetails }: KidsMobileMyListProps) => {
  const { data: watchlist = [], isLoading } = useQuery({
    queryKey: ["kids-watchlist-mobile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: watchlistData, error: watchlistError } = await supabase
        .from("watchlist")
        .select("content_id")
        .eq("user_id", user.id);

      if (watchlistError) throw watchlistError;
      if (!watchlistData?.length) return [];

      const contentIds = watchlistData.map((w) => w.content_id);

      const { data: contentData, error: contentError } = await supabase
        .from("content")
        .select("*")
        .in("id", contentIds)
        .in("content_rating", KIDS_RATINGS)
        .or(`age_limit.is.null,age_limit.lte.${KIDS_MAX_AGE_LIMIT}`);

      if (contentError) throw contentError;

      // Strict client-side filter for age compliance and blocked titles
      return (contentData || [])
        .filter((item: any) => !item.age_limit || item.age_limit <= KIDS_MAX_AGE_LIMIT)
        .filter((item: any) => !isBlockedTitle(item.title || ""))
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

  if (isLoading) {
    return (
      <div className="px-5 pt-6 pb-24 space-y-5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-8 h-8 rounded-xl bg-white/[0.04]" />
          <Skeleton className="w-24 h-5 bg-white/[0.04]" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="w-full aspect-[2/3] rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-24">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
          <Heart className="h-4 w-4 text-white" fill="white" strokeWidth={0} />
        </div>
        <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">My Favorites</h2>
      </div>

      {watchlist.length > 0 ? (
        <motion.div 
          className="grid grid-cols-3 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {watchlist.map((item, index) => (
            <KidsMobileContentCard
              key={item.id}
              content={item}
              onPlay={onPlay}
              onDetails={onDetails}
              index={index}
            />
          ))}
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 rounded-3xl bg-white/[0.04] flex items-center justify-center mb-6 border border-white/[0.06]"
          >
            <Heart className="h-10 w-10 text-white/20" strokeWidth={1.5} />
          </motion.div>
          <h3 className="text-lg font-semibold text-white mb-2 tracking-[-0.02em]">No Favorites Yet</h3>
          <p className="text-[13px] text-white/40 max-w-[220px] font-medium leading-relaxed">
            Tap the heart on shows you love to add them here
          </p>
        </div>
      )}
    </div>
  );
};