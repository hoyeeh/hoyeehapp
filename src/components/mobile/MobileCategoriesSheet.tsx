import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useContent } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { X, Film, Tv, ChevronRight, Grid3X3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MobileContentCard } from "./MobileContentCard";
import { MobileContentDetail } from "./MobileContentDetail";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MobileCategoriesSheetProps {
  open: boolean;
  onClose: () => void;
}

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

  const handleGenreSelect = (genreName: string) => {
    setSelectedGenre(genreName);
  };

  const handleBackToGenres = () => {
    setSelectedGenre(null);
  };

  const handleDetails = (item: Content) => {
    setSelectedContent(item);
  };

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-3xl max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                {selectedGenre ? (
                  <button
                    onClick={handleBackToGenres}
                    className="flex items-center gap-2 text-muted-foreground active:scale-95 transition-transform"
                  >
                    <ChevronRight className="h-5 w-5 rotate-180" />
                    <span className="text-sm font-medium">Back</span>
                  </button>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                      <Grid3X3 className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">Categories</h2>
                      <p className="text-xs text-muted-foreground">Browse by genre</p>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 overflow-y-auto">
              {!selectedGenre ? (
                // Genre List
                <div className="p-4 pb-24">
                  <div className="grid grid-cols-2 gap-3">
                    {genres.map((genre: any, index: number) => (
                      <motion.button
                        key={genre.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => handleGenreSelect(genre.name)}
                        className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl border border-border/30 hover:bg-secondary/80 active:scale-[0.98] transition-all"
                      >
                        <span className="font-medium text-sm">{genre.name}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </motion.button>
                    ))}
                  </div>

                  {/* View All Button */}
                  <button
                    onClick={handleViewAll}
                    className="w-full mt-4 py-3 bg-primary/10 text-primary rounded-xl font-medium text-sm active:scale-[0.98] transition-transform border border-primary/20"
                  >
                    View All in Full Screen
                  </button>
                </div>
              ) : (
                // Genre Content - Full scrollable grid
                <div className="pb-24">
                  {/* Genre Title */}
                  <div className="px-5 py-4 border-b border-border/30">
                    <h3 className="text-xl font-bold">{selectedGenre}</h3>
                    <p className="text-sm text-muted-foreground">
                      {filteredContent.movies.length + filteredContent.shows.length} titles available
                    </p>
                  </div>

                  {/* Movies Section - Grid Layout */}
                  {filteredContent.movies.length > 0 && (
                    <section className="mb-6">
                      <div className="flex items-center gap-2 px-5 py-3 bg-secondary/30 sticky top-0 z-10">
                        <Film className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">Movies</h4>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          {filteredContent.movies.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 px-4 py-3">
                        {filteredContent.movies.map((item) => (
                          <motion.div 
                            key={item.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="aspect-[2/3] relative rounded-lg overflow-hidden bg-secondary cursor-pointer active:scale-95 transition-transform shadow-md"
                            onClick={() => handleDetails(item)}
                          >
                            <img
                              src={item.thumbnailUrl || "/placeholder.svg"}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* TV Shows Section - Grid Layout */}
                  {filteredContent.shows.length > 0 && (
                    <section className="mb-6">
                      <div className="flex items-center gap-2 px-5 py-3 bg-secondary/30 sticky top-0 z-10">
                        <Tv className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">TV Shows</h4>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          {filteredContent.shows.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 px-4 py-3">
                        {filteredContent.shows.map((item) => (
                          <motion.div 
                            key={item.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="aspect-[2/3] relative rounded-lg overflow-hidden bg-secondary cursor-pointer active:scale-95 transition-transform shadow-md"
                            onClick={() => handleDetails(item)}
                          >
                            <img
                              src={item.thumbnailUrl || "/placeholder.svg"}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Empty State */}
                  {filteredContent.movies.length === 0 && filteredContent.shows.length === 0 && (
                    <div className="text-center py-12 px-8">
                      <p className="text-muted-foreground">No content found in this genre.</p>
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
