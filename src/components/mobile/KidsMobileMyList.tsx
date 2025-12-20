import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsMobileContentCard } from "./KidsMobileContentCard";
import { Heart, Film } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface KidsMobileMyListProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

const KIDS_RATINGS = ["G", "PG", "TV-G", "TV-Y", "TV-Y7", "TV-PG"];

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
        .in("content_rating", KIDS_RATINGS);

      if (contentError) throw contentError;

      return (contentData || []).map((item: any) => ({
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
      <div className="px-4 pt-4 pb-24 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-xl bg-white/5" />
          <Skeleton className="w-24 h-6 bg-white/5" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="w-full aspect-[2/3] rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
          <Heart className="h-4 w-4 text-white stroke-[2]" />
        </div>
        <h2 className="text-base font-semibold text-white">My Favorites</h2>
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
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-400/20 to-rose-500/20 flex items-center justify-center mb-4 border border-white/10"
          >
            <Heart className="h-10 w-10 text-pink-400 stroke-[1.5]" />
          </motion.div>
          <h3 className="text-lg font-semibold text-white mb-2">No Favorites Yet</h3>
          <p className="text-sm text-white/50 max-w-[200px]">
            Tap the heart on shows you love to add them here
          </p>
        </div>
      )}
    </div>
  );
};
