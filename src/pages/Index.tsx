import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useProfile } from "@/hooks/useDatabase";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content, ViewState } from "@/types";
import { LandingPage } from "@/components/LandingPage";
import { Sidebar } from "@/components/Sidebar";
import { EnhancedHeroBanner } from "@/components/EnhancedHeroBanner";
import { ContentRow } from "@/components/ContentRow";
import { Top10Row } from "@/components/Top10Row";
import { ContinueWatchingRow } from "@/components/ContinueWatchingRow";
import { ComingSoonRow } from "@/components/ComingSoonRow";
import { RecommendationsRow } from "@/components/RecommendationsRow";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { UserDashboard } from "@/components/UserDashboard";
import { ContentFilter, FilterState } from "@/components/ContentFilter";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { subDays } from "date-fns";

export type ExtendedViewState = ViewState | 'dashboard' | 'downloads' | 'search';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  
  const { data: content = [], isLoading: contentLoading } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const { data: profile } = useProfile();
  
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const [currentView, setCurrentView] = useState<ExtendedViewState>("home");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [playingContent, setPlayingContent] = useState<{ content: Content; progress: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    genre: null,
    year: null,
    contentType: null,
  });

  const handleFilterChange = useCallback((filters: FilterState) => {
    setActiveFilters(filters);
  }, []);

  // Fetch Top 10 content
  const { data: top10Data = [] } = useQuery({
    queryKey: ["top-10-display"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top_10")
        .select(`id, rank, content:content_id (id, title, description, thumbnail_url, video_url, genre, content_type, is_premium, duration, year)`)
        .order("rank");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch home sections config
  const { data: homeSections = [] } = useQuery({
    queryKey: ["home-sections-display"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_sections")
        .select("*, genre:genre_id(name)")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recently added content
  const { data: recentlyAdded = [] } = useQuery({
    queryKey: ["recently-added-home"],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch trending content (most viewed)
  const { data: trendingContent = [] } = useQuery({
    queryKey: ["trending-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .order("view_count", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
  });

  // Transform top 10 data to match Content type
  const top10Content = top10Data
    .filter((item: any) => item.content)
    .map((item: any) => ({
      rank: item.rank,
      content: {
        id: item.content.id,
        title: item.content.title,
        description: item.content.description || "",
        thumbnailUrl: item.content.thumbnail_url || "",
        videoUrl: item.content.video_url || "",
        genre: item.content.genre || "",
        contentType: item.content.content_type as "movie" | "series",
        isPremium: item.content.is_premium || false,
        duration: item.content.duration || 0,
        year: item.content.year,
      } as Content,
    }));

  // Transform trending to Content type
  const trendingContentItems: Content[] = trendingContent.map((item: any) => ({
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
    rating: item.rating,
  }));

  // Transform recently added to Content type
  const recentlyAddedContent: Content[] = recentlyAdded.map((item: any) => ({
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
  }));

  // Redirect to auth if not logged in (handled in LandingPage)
  useEffect(() => {
    if (!authLoading && user) {
      setCurrentView("home");
    }
  }, [user, authLoading]);

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

  const handleDetails = (item: Content) => {
    setSelectedContent(item);
  };

  const handleLogout = async () => {
    await signOut();
    toast.info("You have been signed out");
  };

  const getDisplayContent = () => {
    let filtered = content;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = content.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.genre.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query)
      );
    }
    
    // Apply view filter
    if (currentView === "movies") {
      filtered = filtered.filter((c) => c.contentType === "movie");
    } else if (currentView === "shows") {
      filtered = filtered.filter((c) => c.contentType === "series");
    } else if (currentView === "mylist") {
      filtered = filtered.filter((c) => watchlistIds.includes(c.id));
    }
    
    // Apply genre filter
    if (activeFilters.genre) {
      filtered = filtered.filter((c) =>
        c.genre.toLowerCase().includes(activeFilters.genre!.toLowerCase())
      );
    }
    
    // Apply year filter
    if (activeFilters.year) {
      filtered = filtered.filter((c) => c.year === activeFilters.year);
    }
    
    // Apply content type filter (only when not on specific view)
    if (activeFilters.contentType && currentView !== "movies" && currentView !== "shows") {
      filtered = filtered.filter((c) => c.contentType === activeFilters.contentType);
    }
    
    return filtered;
  };

  const displayContent = getDisplayContent();
  const movies = content.filter((c) => c.contentType === "movie");
  const shows = content.filter((c) => c.contentType === "series");
  const featuredContent = content[0];

  // Get section content based on type
  const getSectionContent = (section: any): Content[] => {
    switch (section.section_type) {
      case "recently_added":
        return recentlyAddedContent;
      case "trending":
        return trendingContentItems;
      case "genre":
        const genreName = section.genre?.name;
        if (!genreName) return [];
        return content.filter((c) => c.genre.toLowerCase().includes(genreName.toLowerCase())).slice(0, section.max_items || 15);
      case "custom":
        if (section.title.toLowerCase().includes("movie")) {
          return movies.slice(0, section.max_items || 15);
        } else if (section.title.toLowerCase().includes("show") || section.title.toLowerCase().includes("series")) {
          return shows.slice(0, section.max_items || 15);
        }
        return content.slice(0, section.max_items || 15);
      default:
        return [];
    }
  };

  // Get content by genre (fallback)
  const getContentByGenre = (genreName: string) => {
    return content.filter((c) => 
      c.genre.toLowerCase().includes(genreName.toLowerCase())
    ).slice(0, 15);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-brand" />
      </div>
    );
  }

  // Video Player View
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

  // Landing Page (not logged in)
  if (!user) {
    return (
      <LandingPage
        onSignIn={() => navigate("/auth")}
        onGetStarted={() => navigate("/auth")}
      />
    );
  }

  // Main App (logged in)
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={handleLogout}
        userName={profile?.display_name || user.email?.split("@")[0]}
      />

      {/* Main Content */}
      <main className="ml-16 md:ml-64">
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-gradient-to-b from-background to-transparent p-4 flex justify-end">
          {showSearch ? (
            <div className="flex items-center gap-2 animate-scale-in">
              <Input
                type="text"
                placeholder="Search titles, genres..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 bg-secondary border-border"
                autoFocus
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                }}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content Loading State */}
        {contentLoading ? (
          <div className="flex items-center justify-center h-[50vh]">
            <Loader2 className="h-12 w-12 animate-spin text-brand" />
          </div>
        ) : (
          <div className="pb-8">
            {/* Dashboard View */}
            {currentView === "dashboard" && (
              <UserDashboard onPlay={handlePlay} onDetails={handleDetails} />
            )}

            {currentView === "home" && !searchQuery && (
              <>
                <EnhancedHeroBanner
                  onPlay={handlePlay}
                  onDetails={handleDetails}
                />
                
                <div className="mt-8 space-y-2">
                  {/* Continue Watching Row - Always first */}
                  <ContinueWatchingRow
                    onPlay={(c, progress) => setPlayingContent({ content: c, progress })}
                    onDetails={handleDetails}
                  />

                  {/* AI Recommendations Row */}
                  <RecommendationsRow
                    onPlay={handlePlay}
                    onToggleList={handleToggleList}
                    onDetails={handleDetails}
                    userList={watchlistIds}
                  />

                  {/* Coming Soon Row - Above Top 10 */}
                  <ComingSoonRow />

                  {/* Render sections from database config - all with wide 16:9 cards */}
                  {homeSections.map((section: any) => {
                    if (section.section_type === "top10") {
                      return top10Content.length > 0 ? (
                        <Top10Row
                          key={section.id}
                          content={top10Content}
                          onPlay={handlePlay}
                          onDetails={handleDetails}
                        />
                      ) : null;
                    }

                    if (section.section_type === "my_list") {
                      return watchlistIds.length > 0 ? (
                        <ContentRow
                          key={section.id}
                          title={section.title}
                          content={content.filter((c) => watchlistIds.includes(c.id))}
                          onPlay={handlePlay}
                          onToggleList={handleToggleList}
                          onDetails={handleDetails}
                          userList={watchlistIds}
                          cardStyle="wide"
                        />
                      ) : null;
                    }

                    const sectionContent = getSectionContent(section);
                    if (sectionContent.length === 0) return null;

                    return (
                      <ContentRow
                        key={section.id}
                        title={section.title}
                        content={sectionContent}
                        onPlay={handlePlay}
                        onToggleList={handleToggleList}
                        onDetails={handleDetails}
                        userList={watchlistIds}
                        cardStyle="wide"
                      />
                    );
                  })}
                </div>
              </>
            )}

            {(currentView === "movies" || currentView === "shows" || currentView === "mylist" || searchQuery) && (
              <div className="px-4 md:px-12 pt-4">
                <h1 className="font-display text-3xl md:text-4xl mb-4">
                  {searchQuery
                    ? `Search results for "${searchQuery}"`
                    : currentView === "movies"
                    ? "Movies"
                    : currentView === "shows"
                    ? "TV Shows"
                    : "My List"}
                </h1>
                
                {/* Content Filter */}
                {(currentView === "movies" || currentView === "shows") && (
                  <ContentFilter
                    onFilterChange={handleFilterChange}
                    contentType={currentView === "movies" ? "movie" : "series"}
                  />
                )}
                
                {displayContent.length === 0 ? (
                  <p className="text-muted-foreground text-lg">
                    {currentView === "mylist"
                      ? "Your list is empty. Add some titles to get started!"
                      : "No content found"}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {displayContent.map((item) => (
                      <div
                        key={item.id}
                        className="cursor-pointer group"
                        onClick={() => handleDetails(item)}
                      >
                        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary relative">
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                          />
                          {item.isPremium && (
                            <div className="absolute top-2 left-2 bg-brand px-2 py-0.5 rounded text-xs font-semibold text-primary-foreground">
                              PREMIUM
                            </div>
                          )}
                        </div>
                        <h3 className="mt-2 font-medium truncate">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.year}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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

      <Toaster position="bottom-right" />
    </div>
  );
};

export default Index;
