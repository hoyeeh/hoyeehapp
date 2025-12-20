import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsMobileContentCard } from "./KidsMobileContentCard";
import { Search, X, Film } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";

interface KidsMobileSearchProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

import { KIDS_RATINGS } from "@/constants/kidsRatings";

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
        .ilike("title", `%${searchQuery}%`)
        .limit(20);
      
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
    enabled: searchQuery.length > 0,
  });

  const { data: popularContent = [] } = useQuery({
    queryKey: ["kids-popular-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .in("content_rating", KIDS_RATINGS)
        .order("view_count", { ascending: false })
        .limit(12);
      
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

  return (
    <div className="min-h-screen pb-24">
      {/* Search Header */}
      <div className="sticky top-[72px] z-40 px-4 py-3 bg-slate-900/95 backdrop-blur-lg border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 stroke-[1.5]" />
          <Input
            type="text"
            placeholder="Search for shows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/40 focus-visible:ring-purple-500/50"
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="h-4 w-4 text-white/60" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Search Results */}
        <AnimatePresence mode="wait">
          {searchQuery.trim() ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <p className="text-sm text-white/50">
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
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-white/30" />
                  </div>
                  <p className="text-white/50">No shows found</p>
                  <p className="text-sm text-white/30 mt-1">Try a different search</p>
                </div>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="popular"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Film className="h-4 w-4 text-white stroke-[2]" />
                </div>
                <h2 className="text-base font-semibold text-white">Popular Shows</h2>
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
