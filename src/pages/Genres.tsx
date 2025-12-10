import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { ContentCard } from "@/components/ContentCard";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Grid, List, SortAsc, SortDesc, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SortOption = "title_asc" | "title_desc" | "year_asc" | "year_desc" | "newest" | "oldest";
type ViewMode = "grid" | "list";

const Genres = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: content = [], isLoading: contentLoading } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [playingContent, setPlayingContent] = useState<{ content: Content; progress: number } | null>(null);

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
        c.genre.toLowerCase().includes(selectedGenre.toLowerCase())
      );
    }

    // Filter by content type
    if (contentType) {
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
      case "year_asc":
        filtered.sort((a, b) => (a.year || 0) - (b.year || 0));
        break;
      case "year_desc":
        filtered.sort((a, b) => (b.year || 0) - (a.year || 0));
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

  const handlePlay = (item: Content) => {
    setSelectedContent(null);
    setPlayingContent({ content: item, progress: 0 });
  };

  const handleDetails = (item: Content) => {
    setSelectedContent(item);
  };

  if (playingContent) {
    return (
      <VideoPlayer
        src={playingContent.content.videoUrl}
        title={playingContent.content.title}
        contentId={playingContent.content.id}
        initialProgress={playingContent.progress}
        onBack={() => setPlayingContent(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display text-2xl md:text-3xl">Browse by Genre</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          {/* Genre Filter */}
          <Select value={selectedGenre || "all"} onValueChange={(v) => setSelectedGenre(v === "all" ? null : v)}>
            <SelectTrigger className="w-[180px] bg-secondary">
              <SelectValue placeholder="All Genres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {genres.map((genre: any) => (
                <SelectItem key={genre.id} value={genre.name}>
                  {genre.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Content Type Filter */}
          <Select value={contentType || "all"} onValueChange={(v) => setContentType(v === "all" ? null : v)}>
            <SelectTrigger className="w-[150px] bg-secondary">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
              <SelectItem value="series">TV Shows</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort By */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[160px] bg-secondary">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="title_asc">Title A-Z</SelectItem>
              <SelectItem value="title_desc">Title Z-A</SelectItem>
              <SelectItem value="year_asc">Year (Low-High)</SelectItem>
              <SelectItem value="year_desc">Year (High-Low)</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Genre Pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedGenre(null)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              !selectedGenre
                ? "bg-brand text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            )}
          >
            All
          </button>
          {genres.map((genre: any) => (
            <button
              key={genre.id}
              onClick={() => setSelectedGenre(genre.name)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                selectedGenre === genre.name
                  ? "bg-brand text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              )}
            >
              {genre.name}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <p className="text-muted-foreground mb-4">
          {filteredContent.length} {filteredContent.length === 1 ? "title" : "titles"} found
        </p>

        {/* Content Grid/List */}
        {contentLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-brand" />
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No content found matching your filters.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredContent.map((item) => (
              <ContentCard
                key={item.id}
                content={item}
                onPlay={handlePlay}
                onToggleList={handleToggleList}
                onDetails={handleDetails}
                isInList={watchlistIds.includes(item.id)}
                cardStyle="poster"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredContent.map((item) => (
              <div
                key={item.id}
                onClick={() => handleDetails(item)}
                className="flex gap-4 p-4 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
              >
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-24 h-36 object-cover rounded"
                />
                <div className="flex-1">
                  <h3 className="font-display text-lg mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {item.year} • {item.genre} • {item.contentType === "movie" ? "Movie" : "TV Show"}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Content Details Modal */}
      {selectedContent && (
        <ContentDetailsModal
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={handlePlay}
          onToggleList={handleToggleList}
          isInList={watchlistIds.includes(selectedContent.id)}
        />
      )}
    </div>
  );
};

export default Genres;
