import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsMobileContentCard } from "./KidsMobileContentCard";
import { Search, X, Film, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT, isKidsContentAllowed } from "@/constants/kidsRatings";

interface KidsMobileSearchProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

export const KidsMobileSearch = ({ onPlay, onDetails }: KidsMobileSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ["kids-search-mobile", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .in("content_rating", KIDS_RATINGS)
        .or("genre.ilike.%animation%,genre.ilike.%family%")
        .or(`age_limit.is.null,age_limit.lte.${KIDS_MAX_AGE_LIMIT}`)
        .ilike("title", `%${searchQuery}%`)
        .limit(20);
      
      if (error) throw error;
      
      // Strict client-side filter for age compliance and blocked titles
      return (data || [])
        .filter((item: any) => isKidsContentAllowed(item))
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
    enabled: searchQuery.length > 0,
  });

  const { data: popularContent = [] } = useQuery({
    queryKey: ["kids-popular-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .in("content_rating", KIDS_RATINGS)
        .or("genre.ilike.%animation%,genre.ilike.%family%")
        .or(`age_limit.is.null,age_limit.lte.${KIDS_MAX_AGE_LIMIT}`)
        .order("view_count", { ascending: false })
        .limit(12);
      
      if (error) throw error;
      
      // Strict client-side filter for age compliance and blocked titles
      return (data || [])
        .filter((item: any) => isKidsContentAllowed(item))
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

  return (
    <div className="min-h-screen pb-24">
      {/* Search Header */}
      <div className="sticky top-[72px] z-40 px-5 py-4 bg-[#0A0A0F]/95 backdrop-blur-2xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" strokeWidth={2} />
          <Input
            type="text"
            placeholder="Search cartoons and family movies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-3.5 h-12 bg-white/[0.06] border-white/[0.06] rounded-2xl text-[15px] text-white placeholder:text-white/30 focus-visible:ring-violet-500/50 font-medium"
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5 text-white/60" strokeWidth={2.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="px-5 pt-2">
        <AnimatePresence mode="wait">
          {searchQuery.trim() ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <p className="text-[13px] text-white/40 font-medium">
                {isLoading 
                  ? "Searching..." 
                  : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
              </p>
              
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {searchResults.map((item, index) => (
                    <KidsMobileContentCard
                      key={item.id}
                      content={item}
                      onPlay={onPlay}
                      onDetails={onDetails}
                      index={index}
                    />
                  ))}
                </div>
              ) : !isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-white/20" strokeWidth={1.5} />
                  </div>
                  <p className="text-[15px] text-white/40 font-medium">No cartoons found</p>
                  <p className="text-[13px] text-white/25 mt-1 font-medium">Try searching for your favorite cartoon</p>
                </div>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="popular"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">Popular Cartoons & Family</h2>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {popularContent.map((item, index) => (
                  <KidsMobileContentCard
                    key={item.id}
                    content={item}
                    onPlay={onPlay}
                    onDetails={onDetails}
                    index={index}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};