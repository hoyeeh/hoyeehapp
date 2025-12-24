import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useProfile } from "@/hooks/useDatabase";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import { Content } from "@/types";
import { Sidebar } from "@/components/Sidebar";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "sonner";
import { Search as SearchIcon, X, Loader2, Filter, SlidersHorizontal, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSearch } from "@/components/mobile/MobileSearch";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT, KIDS_ALLOWED_GENRES, isBlockedTitle } from "@/constants/kidsRatings";

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

const Search = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { currentProfile } = useProfileContext();
  const { data: content = [], isLoading: contentLoading } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  // Check if current profile is kids profile
  const isKidsProfile = currentProfile?.is_kids === true;

  // Return mobile version for mobile devices
  if (isMobile) {
    return <MobileSearch />;
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [playingContent, setPlayingContent] = useState<{ content: Content; progress: number } | null>(null);

  // Advanced filters
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedRating, setSelectedRating] = useState<string>("all");
  const [selectedActor, setSelectedActor] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("title");
  const [showFilters, setShowFilters] = useState(true);

  // SEO meta tags
  useSEO({
    title: searchQuery ? `Search: ${searchQuery}` : 'Search Movies & TV Shows',
    description: 'Search and discover African movies, TV shows, and series on Hoyeeh. Use advanced filters to find exactly what you want to watch.',
    url: 'https://hoyeeh.com/search',
    keywords: [
      'search',
      'find movies',
      'TV shows',
      'African content',
      'streaming',
      'discover',
      'Hoyeeh',
    ],
  });

  // Handle actor query param on mount
  useEffect(() => {
    const actorParam = searchParams.get('actor');
    if (actorParam) {
      setSelectedActor(actorParam);
      setShowFilters(true);
    }
  }, [searchParams]);

  // Fetch genres
  const { data: genres = [] } = useQuery({
    queryKey: ["genres-search"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("genres")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Generate year options
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 50 }, (_, i) => currentYear - i), [currentYear]);

  // Get unique ratings from content
  const ratings = useMemo(() => {
    const uniqueRatings = [...new Set(content.map((c) => c.rating).filter(Boolean))];
    return uniqueRatings.sort();
  }, [content]);

  // Get unique actors from content
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

    // KIDS FILTER: If in kids profile, only show kids-appropriate content
    if (isKidsProfile) {
      filtered = filtered.filter((c: any) => {
        // Check content rating is G or PG
        const ratingOk = c.contentRating && KIDS_RATINGS.includes(c.contentRating);
        // Check age limit is 13 or under
        const ageOk = !c.ageLimit || c.ageLimit <= KIDS_MAX_AGE_LIMIT;
        // Check genre is animation or family
        const genreOk = c.genre && KIDS_ALLOWED_GENRES.some(g => 
          c.genre.toLowerCase().includes(g)
        );
        // Check title is not blocked
        const notBlocked = !isBlockedTitle(c.title || "");
        return ratingOk && ageOk && genreOk && notBlocked;
      });
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.genre.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query)
      );
    }

    // Apply genre filter
    if (selectedGenre !== "all") {
      filtered = filtered.filter((c) =>
        c.genre.toLowerCase().includes(selectedGenre.toLowerCase())
      );
    }

    // Apply year filter
    if (selectedYear !== "all") {
      filtered = filtered.filter((c) => c.year === parseInt(selectedYear));
    }

    // Apply type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((c) => c.contentType === selectedType);
    }

    // Apply rating filter
    if (selectedRating !== "all") {
      filtered = filtered.filter((c) => c.rating === selectedRating);
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
        case "rating":
          return (b.rating || "").localeCompare(a.rating || "");
        case "duration":
          return (b.duration || 0) - (a.duration || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [content, searchQuery, selectedGenre, selectedYear, selectedType, selectedRating, selectedActor, sortBy]);

  const handleToggleList = async (item: Content) => {
    const isInList = watchlistIds.includes(item.id);
    try {
      if (isInList) {
        await removeFromWatchlist.mutateAsync(item.id);
        toast.success("Removed from My List");
      } else {
        await addToWatchlist.mutateAsync(item.id);
        toast.success("Added to My List");
      }
    } catch (error) {
      toast.error("Failed to update watchlist");
    }
  };

  const handlePlay = (item: Content) => {
    if (item.isPremium && !profile?.is_subscribed) {
      toast.error("This content requires a premium subscription");
      return;
    }
    setSelectedContent(null);
    setPlayingContent({ content: item, progress: 0 });
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const clearFilters = () => {
    setSelectedGenre("all");
    setSelectedYear("all");
    setSelectedType("all");
    setSelectedRating("all");
    setSelectedActor("all");
    setSortBy("title");
    setSearchQuery("");
    setSearchParams({});
  };

  const hasActiveFilters =
    selectedGenre !== "all" ||
    selectedYear !== "all" ||
    selectedType !== "all" ||
    selectedRating !== "all" ||
    selectedActor !== "all" ||
    searchQuery;

  if (!user) {
    navigate("/auth");
    return null;
  }

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
      <Sidebar
        currentView={"home"}
        onNavigate={(view) => navigate(view === "home" ? "/" : `/${view}`)}
        onLogout={handleLogout}
        userName={profile?.display_name || user.email?.split("@")[0]}
      />

      <main className="ml-16 md:ml-64 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-3xl md:text-4xl flex items-center gap-3">
                <SearchIcon className="h-8 w-8 text-brand" />
                Search & Discover
              </h1>
              <p className="text-muted-foreground mt-2">
                Find movies and shows with advanced filters
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by title, genre, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg bg-secondary border-border"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-secondary/50 rounded-xl p-4 md:p-6 mb-6 border border-border">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="h-5 w-5 text-brand" />
                <h2 className="font-semibold">Advanced Filters</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* Genre */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Genre</label>
                  <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                    <SelectTrigger>
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
                </div>

                {/* Year */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Year</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Content Type */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Type</label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="movie">Movies</SelectItem>
                      <SelectItem value="series">TV Shows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Rating */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Rating</label>
                  <Select value={selectedRating} onValueChange={setSelectedRating}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Ratings" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ratings</SelectItem>
                      {ratings.map((rating) => (
                        <SelectItem key={rating} value={rating as string}>
                          {rating}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Actor Filter */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Actor</label>
                  <Select value={selectedActor} onValueChange={setSelectedActor}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Actors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actors</SelectItem>
                      {actors.map((actor) => (
                        <SelectItem key={actor} value={actor}>
                          {actor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="title">Title (A-Z)</SelectItem>
                      <SelectItem value="year">Year (Newest)</SelectItem>
                      <SelectItem value="rating">Rating</SelectItem>
                      <SelectItem value="duration">Duration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active Filters & Clear */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
                  <span className="text-sm text-muted-foreground">Active filters:</span>
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1">
                      Search: "{searchQuery}"
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                    </Badge>
                  )}
                  {selectedGenre !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      {selectedGenre}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedGenre("all")} />
                    </Badge>
                  )}
                  {selectedYear !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      {selectedYear}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedYear("all")} />
                    </Badge>
                  )}
                  {selectedType !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      {selectedType === "movie" ? "Movies" : "TV Shows"}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedType("all")} />
                    </Badge>
                  )}
                  {selectedRating !== "all" && (
                    <Badge variant="secondary" className="gap-1">
                      {selectedRating}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedRating("all")} />
                    </Badge>
                  )}
                  {selectedActor !== "all" && (
                    <Badge variant="secondary" className="gap-1 bg-brand/20">
                      <User className="h-3 w-3" />
                      {selectedActor}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => { setSelectedActor("all"); setSearchParams({}); }} />
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Results Count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted-foreground">
              {filteredContent.length} {filteredContent.length === 1 ? "result" : "results"} found
            </p>
          </div>

          {/* Results Grid */}
          {contentLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-brand" />
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-16">
              <SearchIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No results found</h2>
              <p className="text-muted-foreground mb-6">
                Try adjusting your filters or search terms
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredContent.map((item) => (
                <div
                  key={item.id}
                  className="cursor-pointer group bg-secondary/30 rounded-lg overflow-hidden border border-border hover:border-brand/50 transition-colors"
                  onClick={() => setSelectedContent(item)}
                >
                  <div className="aspect-video relative">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                    />
                    <div className="absolute bottom-2 right-2 bg-background/80 px-2 py-0.5 rounded text-xs">
                      {item.contentType === "movie" ? "Movie" : "Series"}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold truncate">{item.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      {item.year && <span>{item.year}</span>}
                      {item.rating && <span>• {item.rating}</span>}
                      {item.genre && <span>• {item.genre}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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

export default Search;
