import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsMobileContentCard } from "./KidsMobileContentCard";
import { Film, Tv, Clock, Moon, Sparkles, Star, Heart, Zap } from "lucide-react";
import { useKidsTimeLimit } from "@/hooks/useKidsTimeLimit";
import { useBedtimeMode } from "@/hooks/useBedtimeMode";
import { useProfileContext } from "@/contexts/ProfileContext";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface KidsMobileHomeProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

const KIDS_RATINGS = ["G", "PG", "TV-G", "TV-Y", "TV-Y7", "TV-PG"];

const SectionIcon = ({ icon: Icon, color }: { icon: typeof Film; color: string }) => (
  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
    <Icon className="h-4 w-4 text-white stroke-[2]" />
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

  const { data: kidsCategories = [] } = useQuery({
    queryKey: ["kids-categories-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categoryMappings = [] } = useQuery({
    queryKey: ["kids-content-categories-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_content_categories")
        .select("content_id, category_id");
      
      if (error) throw error;
      return data || [];
    },
  });

  const getContentForCategory = (categoryId: string): Content[] => {
    const contentIds = categoryMappings
      .filter((m: any) => m.category_id === categoryId)
      .map((m: any) => m.content_id);
    return kidsContent.filter((c) => contentIds.includes(c.id));
  };

  const movies = kidsContent.filter((c) => c.contentType === "movie");
  const shows = kidsContent.filter((c) => c.contentType === "series");

  // Bedtime screen
  if (isBedtime) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center mb-6 shadow-xl shadow-purple-500/30"
        >
          <Moon className="h-12 w-12 text-white" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-3">Time for Bed</h1>
        <p className="text-white/60 text-sm mb-6">
          Rest up for more adventures tomorrow!
        </p>
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Clock className="h-4 w-4 stroke-[1.5]" />
          <span>Bedtime is {bedtimeTime?.slice(0, 5)}</span>
        </div>
      </div>
    );
  }

  // Time limit reached
  if (isTimeLimitReached) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-6 shadow-xl shadow-orange-500/30"
        >
          <Clock className="h-12 w-12 text-white" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-3">All Done for Today</h1>
        <p className="text-white/60 text-sm">
          Come back tomorrow for more fun!
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8 px-4 pt-4">
        <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-6 w-32 bg-white/5" />
            <div className="flex gap-3">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="w-32 h-48 rounded-2xl bg-white/5" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const categorySections = kidsCategories.map((category: any) => ({
    id: category.id,
    title: category.name,
    content: getContentForCategory(category.id),
    color: category.color,
    icon: Star,
  })).filter((s) => s.content.length > 0);

  return (
    <div className="space-y-6 pb-24">
      {/* Welcome Banner */}
      <motion.div 
        className="mx-4 rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-cyan-500/20 border border-white/10 p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">
              Hey{currentProfile?.name ? `, ${currentProfile.name}` : ""}!
            </h2>
            <p className="text-sm text-white/60">Ready to watch something fun?</p>
          </div>
        </div>
        
        {timeRemaining !== null && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-cyan-400 stroke-[1.5]" />
            <span className="text-white/70">
              {timeRemaining > 0 ? `${timeRemaining} min left today` : "Almost done!"}
            </span>
          </div>
        )}
      </motion.div>

      {/* Featured Content */}
      {kidsContent.length > 0 && (
        <section className="space-y-3">
          <div className="px-4 flex items-center gap-2">
            <SectionIcon icon={Zap} color="from-amber-400 to-orange-500" />
            <h2 className="text-base font-semibold text-white">Watch Now</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
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

      {/* Custom Categories */}
      {categorySections.map((section) => (
        <section key={section.id} className="space-y-3">
          <div className="px-4 flex items-center gap-2">
            <SectionIcon icon={section.icon} color={section.color} />
            <h2 className="text-base font-semibold text-white">{section.title}</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {section.content.slice(0, 10).map((item, index) => (
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
      ))}

      {/* Movies */}
      {movies.length > 0 && (
        <section className="space-y-3">
          <div className="px-4 flex items-center gap-2">
            <SectionIcon icon={Film} color="from-pink-400 to-rose-500" />
            <h2 className="text-base font-semibold text-white">Movies</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {movies.slice(0, 10).map((item, index) => (
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
        <section className="space-y-3">
          <div className="px-4 flex items-center gap-2">
            <SectionIcon icon={Tv} color="from-cyan-400 to-blue-500" />
            <h2 className="text-base font-semibold text-white">TV Shows</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {shows.slice(0, 10).map((item, index) => (
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
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center mb-4 shadow-lg">
            <Film className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No Shows Yet</h2>
          <p className="text-white/60 text-sm">Check back soon for fun content!</p>
        </div>
      )}
    </div>
  );
};
