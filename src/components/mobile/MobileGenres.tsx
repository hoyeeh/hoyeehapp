import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { MobileContentCard } from "./MobileContentCard";
import { MobileContentDetail } from "./MobileContentDetail";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileHeader } from "./MobileHeader";
import { MobileSearchOverlay } from "./MobileSearchOverlay";
import { PullToRefresh } from "./PullToRefresh";
import { Loader2, Flame, Film, Tv } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SortOption = "newest" | "oldest" | "title_asc" | "title_desc";

export function MobileGenres() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: content = [], isLoading: contentLoading, refetch } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [showSearch, setShowSearch] = useState(false);

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

  // Filter and sort content
  const filteredContent = useMemo(() => {
    let filtered = [...content];

    // Filter by genre
    if (selectedGenre) {
      filtered = filtered.filter((c) =>
        c.genre?.toLowerCase().includes(selectedGenre.toLowerCase())
      );
    }

    // Filter by content type
    if (contentType !== "all") {
      filtered = filtered.filter((c) => c.contentType === contentType);
    }

    // Sort
    switch (sortBy) {
      case "title_asc":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title_desc":
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "newest":
        filtered.sort((a, b) => (b.year || 0) - (a.year || 0));
        break;
      case "oldest":
        filtered.sort((a, b) => (a.year || 0) - (b.year || 0));
        break;
    }

    return filtered;
  }, [content, selectedGenre, contentType, sortBy]);

  const handleToggleList = async (item: Content) => {
    if (!user) {
      toast.error("Please sign in to add to your list");
      return;
    }
    const isInList = watchlistIds.includes(item.id);
    try {
      if (isInList) {
        await removeFromWatchlist.mutateAsync(item.id);
        toast.success("Removed from My List");
      } else {
        await addToWatchlist.mutateAsync(item.id);
        toast.success("Added to My List");
      }
    } catch {
      toast.error("Failed to update watchlist");
    }
  };

  const handleDetails = (item: Content) => {
    setSelectedContent(item);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleSearchSelect = (item: Content) => {
    setShowSearch(false);
    setSelectedContent(item);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader 
        onSearchClick={() => setShowSearch(true)}
        transparent={false}
      />

      <PullToRefresh onRefresh={handleRefresh}>
        <main className="pt-16 px-4">
          {/* Page Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">New & Hot</h1>
              <p className="text-sm text-muted-foreground">Browse by genre</p>
            </div>
          </div>

          {/* Content Type Filter */}
          <div className="flex gap-2 mb-4">
            {[
              { id: "all", label: "All", icon: null },
              { id: "movie", label: "Movies", icon: Film },
              { id: "series", label: "Series", icon: Tv },
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setContentType(type.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95",
                  contentType === type.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-foreground border border-border/50"
                )}
              >
                {type.icon && <type.icon className="w-4 h-4" />}
                {type.label}
              </button>
            ))}
          </div>

          {/* Genre Pills - Horizontal Scroll */}
          <div className="mb-4 -mx-4 px-4">
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              <button
                onClick={() => setSelectedGenre(null)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-95",
                  !selectedGenre
                    ? "bg-foreground text-background"
                    : "bg-muted/50 text-foreground border border-border/50"
                )}
              >
                All Genres
              </button>
              {genres.map((genre: any) => (
                <button
                  key={genre.id}
                  onClick={() => setSelectedGenre(genre.name)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-95",
                    selectedGenre === genre.name
                      ? "bg-foreground text-background"
                      : "bg-muted/50 text-foreground border border-border/50"
                  )}
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </div>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground mb-4">
            {filteredContent.length} {filteredContent.length === 1 ? "title" : "titles"} found
          </p>

          {/* Content Grid */}
          {contentLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No content found matching your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredContent.map((item) => (
                <MobileContentCard
                  key={item.id}
                  content={item}
                  onDetails={handleDetails}
                />
              ))}
            </div>
          )}
        </main>
      </PullToRefresh>

      {/* Content Detail Modal */}
      {selectedContent && (
        <MobileContentDetail
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={() => {}}
          onToggleList={() => handleToggleList(selectedContent)}
          isInList={watchlistIds.includes(selectedContent.id)}
        />
      )}

      {/* Search Overlay */}
      <MobileSearchOverlay 
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={handleSearchSelect}
      />

      {/* Bottom Nav */}
      <MobileBottomNav />
    </div>
  );
}
