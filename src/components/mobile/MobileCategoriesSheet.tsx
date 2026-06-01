import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useContent } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { X, Film, Tv, ChevronRight, Grid3X3, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MobileGridPoster } from "./MobileGridPoster";
import { MobileContentDetail } from "./MobileContentDetail";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MobileCategoriesSheetProps {
  open: boolean;
  onClose: () => void;
}

// Curated gradient palette for genre tiles (cycled deterministically by index)
const GENRE_GRADIENTS = [
  "from-rose-500/80 via-pink-500/60 to-orange-400/70",
  "from-indigo-500/80 via-purple-500/60 to-fuchsia-400/70",
  "from-emerald-500/80 via-teal-500/60 to-cyan-400/70",
  "from-amber-500/80 via-orange-500/60 to-red-400/70",
  "from-sky-500/80 via-blue-500/60 to-indigo-400/70",
  "from-violet-500/80 via-purple-500/60 to-pink-400/70",
  "from-lime-500/80 via-emerald-500/60 to-green-400/70",
  "from-fuchsia-500/80 via-pink-500/60 to-rose-400/70",
];

export function MobileCategoriesSheet({ open, onClose }: MobileCategoriesSheetProps) {
  const navigate = useNavigate();
  const { data: content = [] } = useContent();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  // Fetch genres
  const { data: genres = [] } = useQuery({
    queryKey: ["genres-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("genres")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Compute representative cover image + counts per genre (uses live content data)
  const genreMeta = useMemo(() => {
    const map: Record<string, { cover?: string; count: number }> = {};
    for (const g of genres as any[]) {
      const matches = content.filter((c) =>
        c.genre?.toLowerCase().includes(String(g.name).toLowerCase())
      );
      map[g.id] = {
        cover: matches.find((m) => m.thumbnailUrl)?.thumbnailUrl,
        count: matches.length,
      };
    }
    return map;
  }, [genres, content]);

  // Filter content by selected genre
  const filteredContent = useMemo(() => {
    if (!selectedGenre) return { movies: [], shows: [] };

    const genreContent = content.filter((c) =>
      c.genre?.toLowerCase().includes(selectedGenre.toLowerCase())
    );

    return {
      movies: genreContent.filter((c) => c.contentType === "movie"),
      shows: genreContent.filter((c) => c.contentType === "series"),
    };
  }, [content, selectedGenre]);

  const handleGenreSelect = (genreName: string) => setSelectedGenre(genreName);
  const handleBackToGenres = () => setSelectedGenre(null);
  const handleDetails = (item: Content) => setSelectedContent(item);
  const handleViewAll = () => {
    onClose();
    navigate("/genres");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
              <div className="flex items-center gap-3">
                {selectedGenre ? (
                  <button
                    onClick={handleBackToGenres}
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                  >
                    <ChevronRight className="h-5 w-5 rotate-180" />
                    <span className="text-sm font-medium">Categories</span>
                  </button>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/40 flex items-center justify-center shadow-lg shadow-primary/20">
                      <Grid3X3 className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold leading-tight">Categories</h2>
                      <p className="text-xs text-muted-foreground">
                        {genres.length} genres • Browse by mood
                      </p>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center active:scale-95 transition-transform"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 overflow-y-auto">
              {!selectedGenre ? (
                // Genre tiles - visual responsive grid
                <div className="p-4 pb-28">
                  <div className="grid grid-cols-2 gap-3">
                    {(genres as any[]).map((genre, index) => {
                      const meta = genreMeta[genre.id] || { count: 0 };
                      const gradient = GENRE_GRADIENTS[index % GENRE_GRADIENTS.length];
                      return (
                        <motion.button
                          key={genre.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index * 0.025, 0.4) }}
                          onClick={() => handleGenreSelect(genre.name)}
                          className="group relative aspect-[16/10] w-full rounded-2xl overflow-hidden border border-border/30 active:scale-[0.97] transition-transform shadow-md"
                        >
                          {/* Cover image background - fully responsive */}
                          {meta.cover ? (
                            <img
                              src={meta.cover}
                              alt={genre.name}
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-secondary" />
                          )}

                          {/* Color overlay for cohesion + legibility */}
                          <div
                            className={cn(
                              "absolute inset-0 bg-gradient-to-br opacity-80 mix-blend-multiply",
                              gradient
                            )}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                          {/* Text */}
                          <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                            <h3 className="text-white font-bold text-sm leading-tight drop-shadow-md line-clamp-2">
                              {genre.name}
                            </h3>
                            {meta.count > 0 && (
                              <p className="text-[10px] font-medium text-white/85 mt-0.5">
                                {meta.count} titles
                              </p>
                            )}
                          </div>

                          <ChevronRight className="absolute top-2.5 right-2.5 h-4 w-4 text-white/90" />
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* View All Button */}
                  <button
                    onClick={handleViewAll}
                    className="w-full mt-5 py-3.5 bg-gradient-to-r from-primary/15 to-primary/5 text-primary rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform border border-primary/25 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Explore All Genres
                  </button>
                </div>
              ) : (
                // Genre content - responsive cover grid
                <div className="pb-28">
                  {/* Genre Title */}
                  <div className="px-5 py-4 border-b border-border/30">
                    <h3 className="text-2xl font-bold tracking-tight">{selectedGenre}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {filteredContent.movies.length + filteredContent.shows.length} titles available
                    </p>
                  </div>

                  {/* Movies Section */}
                  {filteredContent.movies.length > 0 && (
                    <section className="mb-4">
                      <div className="flex items-center gap-2 px-5 py-3 bg-background/95 backdrop-blur-md sticky top-0 z-10 border-b border-border/30">
                        <Film className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">Movies</h4>
                        <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          {filteredContent.movies.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 [@media(min-width:480px)]:grid-cols-4 [@media(min-width:640px)]:grid-cols-5 gap-2.5 px-3 py-3">
                        {filteredContent.movies.map((item, idx) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(idx * 0.015, 0.3) }}
                            className="w-full"
                          >
                            <MobileContentCard
                              content={item}
                              onDetails={handleDetails}
                              variant="poster"
                              cardStyle="poster"
                              cardSize="md"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* TV Shows Section */}
                  {filteredContent.shows.length > 0 && (
                    <section className="mb-4">
                      <div className="flex items-center gap-2 px-5 py-3 bg-background/95 backdrop-blur-md sticky top-0 z-10 border-b border-border/30">
                        <Tv className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">TV Shows</h4>
                        <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          {filteredContent.shows.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 [@media(min-width:480px)]:grid-cols-4 [@media(min-width:640px)]:grid-cols-5 gap-2.5 px-3 py-3">
                        {filteredContent.shows.map((item, idx) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(idx * 0.015, 0.3) }}
                            className="w-full"
                          >
                            <MobileContentCard
                              content={item}
                              onDetails={handleDetails}
                              variant="poster"
                              cardStyle="poster"
                              cardSize="md"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Empty State */}
                  {filteredContent.movies.length === 0 && filteredContent.shows.length === 0 && (
                    <div className="text-center py-16 px-8">
                      <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center mb-3">
                        <Grid3X3 className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        No content found in this genre yet.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </motion.div>

          {/* Content Detail Modal */}
          {selectedContent && (
            <MobileContentDetail
              content={selectedContent}
              onClose={() => setSelectedContent(null)}
              onPlay={() => {}}
              onToggleList={() => {}}
              isInList={false}
            />
          )}
        </>
      )}
    </AnimatePresence>
  );
}
