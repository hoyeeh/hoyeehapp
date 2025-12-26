import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, X, ArrowLeft, SlidersHorizontal, Film, Tv, Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useProfile } from "@/hooks/useDatabase";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { toast } from "sonner";
import { useHaptics } from "@/hooks/useHaptics";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileContentDetail } from "./MobileContentDetail";
import { MobileContentCard } from "./MobileContentCard";
import { MobileSwipeWrapper } from "./MobileSwipeWrapper";
import { motion, AnimatePresence } from "framer-motion";

// Parse cast members from content
const parseCastMembers = (castMembers: any): { name: string }[] => {
  if (!castMembers) return [];
  if (Array.isArray(castMembers)) return castMembers;
  try {
    return typeof castMembers === 'string' ? JSON.parse(castMembers) : [];
  } catch {
    return [];
  }
};

export function MobileSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: content = [], isLoading } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const { lightTap, selectionTap, successFeedback } = useHaptics();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  // Filter states
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedActor, setSelectedActor] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("title");

  // Handle actor query param
  useEffect(() => {
    const actorParam = searchParams.get('actor');
    if (actorParam) {
      setSelectedActor(actorParam);
      setShowFilters(true);
    }
  }, [searchParams]);

  // Fetch genres
  const { data: genres = [] } = useQuery({
    queryKey: ["genres-mobile-search"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("genres")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Get current year for year filter
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 30 }, (_, i) => currentYear - i), [currentYear]);

  // Get unique actors
  const actors = useMemo(() => {
    const actorSet = new Set<string>();
    content.forEach((c: any) => {
      const cast = parseCastMembers(c.cast_members);
      cast.forEach((member: any) => {
        if (member.name) actorSet.add(member.name);
      });
    });
    return Array.from(actorSet).sort();
  }, [content]);

  // Filter and sort content
  const filteredContent = useMemo(() => {
    let filtered = content;

    // Apply search query
    if (query.length >= 2) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.genre?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
      );
    }

    // Apply genre filter
    if (selectedGenre !== "all") {
      filtered = filtered.filter((c) =>
        c.genre?.toLowerCase().includes(selectedGenre.toLowerCase())
      );
    }

    // Apply type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((c) => c.contentType === selectedType);
    }

    // Apply year filter
    if (selectedYear !== "all") {
      filtered = filtered.filter((c) => c.year === parseInt(selectedYear));
    }

    // Apply actor filter
    if (selectedActor !== "all") {
      filtered = filtered.filter((c: any) => {
        const cast = parseCastMembers(c.cast_members);
        return cast.some((member: any) =>
          member.name?.toLowerCase() === selectedActor.toLowerCase()
        );
      });
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "title":
          return a.title.localeCompare(b.title);
        case "year":
          return (b.year || 0) - (a.year || 0);
        case "recent":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [content, query, selectedGenre, selectedType, selectedYear, selectedActor, sortBy]);

  const hasActiveFilters = selectedGenre !== "all" || selectedType !== "all" || 
    selectedYear !== "all" || selectedActor !== "all";

  const clearFilters = () => {
    selectionTap();
    setSelectedGenre("all");
    setSelectedType("all");
    setSelectedYear("all");
    setSelectedActor("all");
    setSortBy("title");
    setQuery("");
    setSearchParams({});
  };

  const handlePlay = (item: Content) => {
    lightTap();
    if (item.isPremium && !profile?.is_subscribed) {
      toast.error("Premium subscription required");
      navigate("/subscription");
      return;
    }
    navigate(`/content/${item.id}?play=true`);
  };

  const handleToggleList = async (item: Content) => {
    const isInList = watchlistIds.includes(item.id);
    try {
      if (isInList) {
        await removeFromWatchlist.mutateAsync(item.id);
        toast.success("Removed from My List");
      } else {
        await addToWatchlist.mutateAsync(item.id);
        successFeedback();
        toast.success("Added to My List");
      }
    } catch (error) {
      toast.error("Failed to update watchlist");
    }
  };

  const handleBack = () => {
    lightTap();
    navigate(-1);
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  // Recommended content when no search
  const recommended = content.slice(0, 12);
  const showResults = query.length >= 2 || hasActiveFilters;

  return (
    <MobileSwipeWrapper>
      <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border/30 pt-safe z-50">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-secondary rounded-xl transition-colors active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search movies, series..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                "w-full h-10 pl-9 pr-10 rounded-xl",
                "bg-secondary/80 border border-border/50",
                "text-sm text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                "transition-all duration-200"
              )}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              selectionTap();
              setShowFilters(!showFilters);
            }}
            className={cn(
              "p-2 rounded-xl transition-colors active:scale-95",
              showFilters || hasActiveFilters ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
            )}
          >
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Chips */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 space-y-3 border-t border-border/20">
                {/* Content Type */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Type</p>
                  <div className="flex gap-2">
                    {[
                      { value: "all", label: "All" },
                      { value: "movie", label: "Movies", icon: Film },
                      { value: "series", label: "Series", icon: Tv },
                    ].map((type) => (
                      <button
                        key={type.value}
                        onClick={() => {
                          selectionTap();
                          setSelectedType(type.value);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                          selectedType === type.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/80 text-foreground hover:bg-secondary"
                        )}
                      >
                        {type.icon && <type.icon className="h-3 w-3" />}
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Genre */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Genre</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      onClick={() => {
                        selectionTap();
                        setSelectedGenre("all");
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                        selectedGenre === "all"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/80 text-foreground"
                      )}
                    >
                      All
                    </button>
                    {genres.map((genre: any) => (
                      <button
                        key={genre.id}
                        onClick={() => {
                          selectionTap();
                          setSelectedGenre(genre.name);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                          selectedGenre === genre.name
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/80 text-foreground"
                        )}
                      >
                        {genre.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Year */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Year</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      onClick={() => {
                        selectionTap();
                        setSelectedYear("all");
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                        selectedYear === "all"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/80 text-foreground"
                      )}
                    >
                      All Years
                    </button>
                    {years.slice(0, 15).map((year) => (
                      <button
                        key={year}
                        onClick={() => {
                          selectionTap();
                          setSelectedYear(year.toString());
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                          selectedYear === year.toString()
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/80 text-foreground"
                        )}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Sort by</p>
                  <div className="flex gap-2">
                    {[
                      { value: "title", label: "Title", icon: undefined },
                      { value: "year", label: "Newest", icon: Clock },
                      { value: "recent", label: "Recently Added", icon: Star },
                    ].map((sort) => (
                      <button
                        key={sort.value}
                        onClick={() => {
                          selectionTap();
                          setSortBy(sort.value);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                          sortBy === sort.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/80 text-foreground"
                        )}
                      >
                        {sort.icon && <sort.icon className="h-3 w-3" />}
                        {sort.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-primary font-medium underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Content */}
      <main className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : showResults ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {filteredContent.length} result{filteredContent.length !== 1 ? "s" : ""}
                {query && ` for "${query}"`}
              </p>
            </div>

            {filteredContent.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {filteredContent.map((item) => (
                  <MobileContentCard
                    key={item.id}
                    content={item}
                    onDetails={(c) => {
                      lightTap();
                      setSelectedContent(c);
                    }}
                    variant="poster"
                    showBadges={false}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                  <Search className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Results Found</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold mb-4">Recommended for You</h3>
            <div className="grid grid-cols-3 gap-3">
              {recommended.map((item) => (
                <MobileContentCard
                  key={item.id}
                  content={item}
                  onDetails={(c) => {
                    lightTap();
                    setSelectedContent(c);
                  }}
                  variant="poster"
                  showBadges={false}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <MobileBottomNav />

      {/* Content Detail Modal */}
      {selectedContent && (
        <MobileContentDetail
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={handlePlay}
          isInList={watchlistIds.includes(selectedContent.id)}
          onToggleList={() => handleToggleList(selectedContent)}
        />
      )}
    </div>
    </MobileSwipeWrapper>
  );
}
