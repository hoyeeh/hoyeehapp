import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
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
import { LeavingSoonRow } from "@/components/LeavingSoonRow";
import { ComingSoonRow } from "@/components/ComingSoonRow";
import { RecommendationsRow } from "@/components/RecommendationsRow";
import { NewReleasesRow } from "@/components/NewReleasesRow";
import { AIRecommendationsRow } from "@/components/AIRecommendationsRow";
import { RecentlyWatchedRow } from "@/components/RecentlyWatchedRow";
import { BecauseYouWatchedRow } from "@/components/BecauseYouWatchedRow";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { UserDashboard } from "@/components/UserDashboard";
import { ContentFilter, FilterState } from "@/components/ContentFilter";
import { ProfilePicker } from "@/components/ProfilePicker";
import { KidsInterface } from "@/components/KidsInterface";
import { KidsHomePage } from "@/components/KidsHomePage";
import { ParentalDashboard } from "@/components/ParentalDashboard";
import { ParentalPinModal } from "@/components/ParentalPinModal";
import { isRestrictedForKids, isRestrictedByParentalControls } from "@/components/ContentRatingBadge";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { SupportChat } from "@/components/SupportChat";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { subDays } from "date-fns";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { MobileHome } from "@/components/mobile";
import { MobileOnboarding } from "@/components/mobile/MobileOnboarding";
import { MobileErrorBoundary } from "@/components/mobile/MobileErrorBoundary";
import { MobileLandingPage } from "@/components/mobile/MobileLandingPage";
import { MiniPlayerProvider } from "@/contexts/MiniPlayerContext";
import { MiniPlayer } from "@/components/MiniPlayer";
import { HomeYouTubeRow } from "@/components/HomeYouTubeRow";
import { HomepageSpotlight } from "@/components/spotlight/HomepageSpotlight";
import { PaidContentRow } from "@/components/PaidContentRow";
import { PurchaseModal } from "@/components/creator/PurchaseModal";
import { PlayablesSection } from "@/components/playables";

export type ExtendedViewState = ViewState | 'dashboard' | 'downloads' | 'search' | 'parental';


const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isMobileDevice, isTablet } = useMobileDevice();
  const isMobileOrTablet = isMobileDevice || isTablet;
  
  const { profiles, currentProfile, setCurrentProfile, loading: profilesLoading } = useProfileContext();
  
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
  const [pinModalContent, setPinModalContent] = useState<Content | null>(null);
  const [purchaseModalContent, setPurchaseModalContent] = useState<any>(null);
  const [checkingPaidContentId, setCheckingPaidContentId] = useState<string | null>(null);
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

  // Fetch home sections config - filter for desktop display
  const { data: homeSections = [] } = useQuery({
    queryKey: ["home-sections-display"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_sections")
        .select("*, genre:genre_id(name)")
        .eq("is_active", true)
        .eq("show_on_desktop", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch global deduplication setting
  const { data: deduplicationSetting } = useQuery({
    queryKey: ["home-deduplication-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("setting_value")
        .eq("setting_key", "home_enable_deduplication")
        .single();
      if (error) return { setting_value: "true" };
      return data;
    },
  });

  const enableDeduplication = deduplicationSetting?.setting_value !== "false";

  // Fetch section content for curated sections
  const { data: sectionContentData = [] } = useQuery({
    queryKey: ["section-content-display"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_content")
        .select("*, content:content_id(*)");
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

  // Fetch trending content (most viewed) - Top 20 for "What to Watch"
  const { data: trendingContent = [] } = useQuery({
    queryKey: ["trending-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .order("view_count", { ascending: false })
        .limit(20);
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

  // Sort helper: most recent year first (persistent ordering)
  const sortByYearDesc = <T extends { year?: number | null }>(items: T[]): T[] =>
    [...items].sort((a, b) => (b.year || 0) - (a.year || 0));

  // Transform trending to Content type — re-ordered by most recent year first
  const trendingContentItems: Content[] = sortByYearDesc(
    trendingContent.map((item: any) => ({
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
    }))
  );

  // Transform recently added to Content type — re-ordered by most recent year first
  const recentlyAddedContent: Content[] = sortByYearDesc(
    recentlyAdded.map((item: any) => ({
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
    }))
  );

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

  const handlePlay = async (item: Content) => {
    // Check kids profile restrictions
    if (currentProfile?.is_kids && isRestrictedForKids(item.contentRating)) {
      toast.error("This content is not available for Kids profiles");
      return;
    }
    
    // Check parental controls (use has_parental_pin flag from safe view)
    if (profile?.parental_controls_enabled && profile?.has_parental_pin) {
      if (isRestrictedByParentalControls(item.contentRating, profile?.parental_rating_limit)) {
        setPinModalContent(item);
        return;
      }
    }
    
    // Check if content is paid creator content (takes priority over subscription)
    try {
      const { data: paidContent } = await supabase
        .from('paid_content')
        .select(`
          id,
          price,
          currency,
          creator_id,
          is_active,
          is_free,
          content(*),
          creator_profiles(id, display_name, avatar_url, is_verified)
        `)
        .eq('content_id', item.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (paidContent && !paidContent.is_free) {
        // Content is paid creator content (not free) - check if user has purchased it
        const { data: purchase } = await supabase
          .from('content_purchases')
          .select('id')
          .eq('user_id', user?.id || '')
          .eq('content_id', item.id)
          .eq('status', 'completed')
          .maybeSingle();
        
        if (!purchase) {
          // User hasn't purchased - show purchase modal
          setPurchaseModalContent(paidContent);
          return;
        }
        // User has purchased - allow playback (fall through to normal logic)
      }
      // If paidContent.is_free is true, allow playback without purchase
    } catch (error) {
      console.error('Error checking paid content:', error);
    }
    
    if (item.isPremium && !profile?.is_subscribed) {
      toast.error("This content requires a premium subscription");
      return;
    }
    
    // For TV series, navigate to content detail to select an episode
    if (item.contentType === "series") {
      setSelectedContent(null);
      navigate(`/content/${item.id}`);
      return;
    }
    
    // For movies, check if video URL exists
    if (!item.videoUrl) {
      toast.error("This content is not yet available");
      return;
    }
    
    setSelectedContent(null);
    setPlayingContent({ content: item, progress: 0 });
  };

  const handleDetails = async (item: Content) => {
    // Show loading indicator
    setCheckingPaidContentId(item.id);
    
    // Check if this is paid creator content that requires purchase first
    try {
      const { data: paidContent } = await supabase
        .from('paid_content')
        .select(`
          id,
          price,
          currency,
          creator_id,
          is_active,
          is_free,
          content(*),
          creator_profiles(id, display_name, avatar_url, is_verified)
        `)
        .eq('content_id', item.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (paidContent && !paidContent.is_free) {
        // Content is paid creator content - check if user has purchased it
        const { data: purchase } = await supabase
          .from('content_purchases')
          .select('id')
          .eq('user_id', user?.id || '')
          .eq('content_id', item.id)
          .eq('status', 'completed')
          .maybeSingle();
        
        if (!purchase) {
          // User hasn't purchased - show purchase modal instead of content detail
          setPurchaseModalContent(paidContent);
          return;
        }
        // User has purchased - show content detail (fall through)
      }
      // If not paid content or is_free, show content detail
    } catch (error) {
      console.error('Error checking paid content:', error);
    } finally {
      setCheckingPaidContentId(null);
    }
    
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

  // Transform raw content to Content type
  const transformRawContent = (item: any): Content => ({
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
  });

  // Get raw section content based on type (before deduplication)
  const getRawSectionContent = (section: any): Content[] => {
    switch (section.section_type) {
      case "leaving_soon":
        // Return empty - we'll use the dedicated LeavingSoonRow component instead
        return [];
      case "recently_added":
        return recentlyAddedContent;
      case "trending":
        return trendingContentItems;
      case "genre":
        const genreName = section.genre?.name;
        if (!genreName) return [];
        return content
          .filter((c) => c.genre.toLowerCase().includes(genreName.toLowerCase()))
          .sort((a, b) => (b.year || 0) - (a.year || 0))
          .slice(0, section.max_items || 15);
      case "curated":
        // Get curated content from section_content table
        const curatedItems = sectionContentData
          .filter((sc: any) => sc.section_id === section.id && sc.content)
          .map((sc: any) => transformRawContent(sc.content))
          .sort((a: Content, b: Content) => (b.year || 0) - (a.year || 0));
        return curatedItems.slice(0, section.max_items || 15);
      case "by_year":
        // Extract year from section title (e.g., "Movies 2024", "2023 Films")
        const yearMatch = section.title.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          const year = parseInt(yearMatch[0]);
          return content
            .filter((c) => c.year === year)
            .sort((a, b) => (b.year || 0) - (a.year || 0))
            .slice(0, section.max_items || 15);
        }
        // Fallback: group by most recent years
        return content
          .filter((c) => c.year)
          .sort((a, b) => (b.year || 0) - (a.year || 0))
          .slice(0, section.max_items || 15);
      case "custom":
        // Filter by content type if specified and sort by year
        let filtered: Content[] = [];
        if (section.content_type_filter === "movie") {
          filtered = movies;
        } else if (section.content_type_filter === "series") {
          filtered = shows;
        } else if (section.title.toLowerCase().includes("movie")) {
          filtered = movies;
        } else if (section.title.toLowerCase().includes("show") || section.title.toLowerCase().includes("series")) {
          filtered = shows;
        } else {
          filtered = content;
        }
        return filtered
          .sort((a, b) => (b.year || 0) - (a.year || 0))
          .slice(0, section.max_items || 15);
      case "free_content":
        // Check if curated - use section_content table
        if (section.is_curated) {
          const curatedFree = sectionContentData
            .filter((sc: any) => sc.section_id === section.id && sc.content && !sc.content.is_premium)
            .map((sc: any) => transformRawContent(sc.content));
          return curatedFree.slice(0, section.max_items || 15);
        }
        // Filter for non-premium (free) content
        let freeFiltered = content.filter((c) => !c.isPremium);
        if (section.content_type_filter === "movie") {
          freeFiltered = freeFiltered.filter((c) => c.contentType === "movie");
        } else if (section.content_type_filter === "series") {
          freeFiltered = freeFiltered.filter((c) => c.contentType === "series");
        }
        return freeFiltered
          .sort((a, b) => (b.year || 0) - (a.year || 0))
          .slice(0, section.max_items || 15);
      case "series":
        // Series section with optional genre and year filters
        let seriesFiltered = shows;
        // Apply genre filter if set
        if (section.genre?.name) {
          seriesFiltered = seriesFiltered.filter((c) => 
            c.genre?.toLowerCase().includes(section.genre.name.toLowerCase())
          );
        }
        // Apply year filter if set
        if (section.year_filter) {
          seriesFiltered = seriesFiltered.filter((c) => c.year === section.year_filter);
        }
        return seriesFiltered
          .sort((a, b) => (b.year || 0) - (a.year || 0))
          .slice(0, section.max_items || 15);
      default:
        return [];
    }
  };

  // Process all sections with deduplication (respects per-section allow_duplicates setting)
  const processedHomeSections = useMemo(() => {
    const displayedContentIds = new Set<string>();
    
    return homeSections.map((section: any) => {
      let sectionContent = getRawSectionContent(section);
      
      // Check per-section allow_duplicates setting, only apply deduplication if global setting is enabled
      const shouldDeduplicate = enableDeduplication && !section.allow_duplicates;
      
      if (shouldDeduplicate) {
        sectionContent = sectionContent.filter((item) => {
          if (displayedContentIds.has(item.id)) {
            return false;
          }
          displayedContentIds.add(item.id);
          return true;
        });
      } else {
        // Still track content for later deduplication
        sectionContent.forEach((item) => displayedContentIds.add(item.id));
      }
      
      return { section, content: sectionContent };
    });
  }, [homeSections, content, recentlyAddedContent, trendingContentItems, sectionContentData, movies, shows, enableDeduplication]);

  // Get content by genre (fallback) - uses default limit, admin sections have own max_items
  const getContentByGenre = (genreName: string, maxItems: number = 20) => {
    return content
      .filter((c) => c.genre.toLowerCase().includes(genreName.toLowerCase()))
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, maxItems);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  // Video Player View - Only for desktop (mobile uses PersistentMobileVideoPlayer)
  if (playingContent && !isMobileOrTablet) {
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

  // Landing Page (not logged in) - Mobile/Tablet gets mobile landing
  if (!user) {
    if (isMobileOrTablet) {
      return (
        <MobileOnboarding>
          <MobileLandingPage
            onSignIn={() => navigate("/auth")}
            onGetStarted={() => navigate("/auth")}
          />
        </MobileOnboarding>
      );
    }
    
    return (
      <LandingPage
        onSignIn={() => navigate("/auth")}
        onGetStarted={() => navigate("/auth")}
      />
    );
  }

  // Redirect to profile picker if no profile selected
  if (user && !currentProfile && !profilesLoading) {
    navigate("/profiles", { replace: true });
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading profiles..." />
      </div>
    );
  }

  // Main App (logged in) - Wrap with KidsInterface for kids profiles
  // Kids profile shows simplified kids-only content
  if (currentProfile?.is_kids) {
    return (
      <KidsInterface>
        <KidsHomePage onPlay={handlePlay} onDetails={handleDetails} />
        
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
      </KidsInterface>
    );
  }

  // Mobile PWA Experience
  if (isMobileOrTablet) {
    console.log('[Index] Rendering mobile PWA experience');
    return (
      <MiniPlayerProvider>
        <MobileErrorBoundary>
          <MobileOnboarding>
            <MobileHome />
            <MiniPlayer onRestore={(content, progress) => setPlayingContent({ content, progress })} />
            <PWAInstallBanner />
            <Toaster position="top-center" />
          </MobileOnboarding>
        </MobileErrorBoundary>
      </MiniPlayerProvider>
    );
  }

  return (
    <KidsInterface>
      <div className="min-h-screen bg-background">
        <Sidebar
          currentView={currentView}
          onNavigate={setCurrentView}
          onLogout={handleLogout}
          userName={profile?.display_name || user.email?.split("@")[0]}
        />

        {/* Main Content */}
        <main className="ml-16 md:ml-64">
        {/* Top Bar - Transparent on desktop to blend with hero banner */}
        <div className="sticky top-0 z-40 p-4 flex justify-end bg-gradient-to-b from-background to-transparent md:bg-none md:bg-transparent md:absolute md:right-0 md:left-auto">
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
              className="p-2 rounded-lg transition-colors md:bg-transparent md:hover:bg-transparent hover:bg-secondary"
            >
              <Search className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content Loading State */}
        {contentLoading ? (
          <div className="flex items-center justify-center h-[50vh]">
            <LoadingSpinner size="lg" text="Loading content..." />
          </div>
        ) : (
          <div className="pb-8">
            {/* Parental Dashboard View */}
            {currentView === "parental" && (
              <ParentalDashboard onBack={() => setCurrentView("home")} />
            )}
            
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
                
                {/* Spotlight Ads - Below hero, above content rows */}
                <HomepageSpotlight appContext="main" />
                
                <div className="mt-8 space-y-2">
                  {/* All sections rendered dynamically based on admin configuration */}
                  {processedHomeSections.map(({ section, content: sectionContent }) => {
                    // Continue Watching section
                    if (section.section_type === "continue_watching") {
                      return (
                        <ContinueWatchingRow
                          key={section.id}
                          onPlay={(c, progress) => setPlayingContent({ content: c, progress })}
                          onDetails={handleDetails}
                        />
                      );
                    }

                    // Recently Watched section
                    if (section.section_type === "recently_watched") {
                      return (
                        <RecentlyWatchedRow
                          key={section.id}
                          onPlay={handlePlay}
                          onDetails={handleDetails}
                        />
                      );
                    }

                    // New Releases section
                    if (section.section_type === "new_releases") {
                      return (
                        <NewReleasesRow
                          key={section.id}
                          onPlay={handlePlay}
                          onToggleList={handleToggleList}
                          onDetails={handleDetails}
                          userList={watchlistIds}
                          title={section.title || "New Releases"}
                          maxItems={section.max_items || 20}
                          contentTypeFilter={
                            (section.content_type_filter as "all" | "movie" | "series") || "all"
                          }
                          firstCardStyle={
                            (section.first_card_style as "poster" | "backdrop" | "full") || "backdrop"
                          }
                          sectionBannerUrl={section.section_banner_url || undefined}
                          featuredContentId={section.featured_content_id || undefined}
                        />
                      );
                    }

                    // Recommendations section
                    if (section.section_type === "recommendations") {
                      return (
                        <RecommendationsRow
                          key={section.id}
                          onPlay={handlePlay}
                          onToggleList={handleToggleList}
                          onDetails={handleDetails}
                          userList={watchlistIds}
                        />
                      );
                    }

                    // Because You Watched section
                    if (section.section_type === "because_you_watched") {
                      return (
                        <BecauseYouWatchedRow
                          key={section.id}
                          onPlay={handlePlay}
                          onToggleList={handleToggleList}
                          onDetails={handleDetails}
                          userList={watchlistIds}
                          cardStyle={(section.card_style as "poster" | "backdrop" | "wide" | "square" | "minimal") || "poster"}
                          cardSize={(section.card_size as "sm" | "md" | "lg") || "md"}
                        />
                      );
                    }

                    // Playables section
                    if (section.section_type === "playables") {
                      return <PlayablesSection key={section.id} className="mt-6" />;
                    }

                    // Coming Soon section
                    if (section.section_type === "coming_soon") {
                      return <ComingSoonRow key={section.id} />;
                    }

                    // AI Recommendations section
                    if (section.section_type === "ai_recommendations") {
                      return (
                        <AIRecommendationsRow
                          key={section.id}
                          onPlay={handlePlay}
                          onToggleList={handleToggleList}
                          onDetails={handleDetails}
                          userList={watchlistIds}
                        />
                      );
                    }

                    // Top 10 section
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

                    // My List section
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
                          cardStyle={(section.card_style as "poster" | "backdrop" | "wide" | "square" | "minimal") || "poster"}
                          cardSize={(section.card_size as "sm" | "md" | "lg") || "md"}
                          showSeeAll
                          onSeeAll={() => navigate("/my-list")}
                        />
                      ) : null;
                    }

                    // YouTube section
                    if (section.section_type === "youtube") {
                      return (
                        <HomeYouTubeRow
                          key={section.id}
                          title={section.title}
                          maxItems={section.max_items || 15}
                          cardStyle={section.card_style as "poster" | "backdrop" | "wide" | "square" | "minimal"}
                        />
                      );
                    }

                    // Creator Studio / Paid Content section
                    if (section.section_type === "creator_store") {
                      return (
                        <PaidContentRow
                          key={section.id}
                          title={section.title}
                          onPlay={handlePlay}
                          onToggleList={handleToggleList}
                          onDetails={handleDetails}
                          userList={watchlistIds}
                          maxItems={section.max_items || 15}
                        />
                      );
                    }

                    // Leaving Soon section
                    if (section.section_type === "leaving_soon") {
                      return (
                        <LeavingSoonRow
                          key={section.id}
                          onPlay={handlePlay}
                          onToggleList={handleToggleList}
                          onDetails={handleDetails}
                          myList={watchlistIds}
                        />
                      );
                    }

                    // Generic content sections (genre, curated, custom, etc.)
                    if (sectionContent.length === 0) return null;

                    const seeAllRoute = section.section_type === "free_content" 
                      ? "/free-content" 
                      : "/genres";

                    return (
                      <ContentRow
                        key={section.id}
                        title={section.title}
                        content={sectionContent}
                        onPlay={handlePlay}
                        onToggleList={handleToggleList}
                        onDetails={handleDetails}
                        userList={watchlistIds}
                        cardStyle={(section.card_style as "poster" | "backdrop" | "wide" | "square" | "minimal") || "poster"}
                        cardSize={(section.card_size as "sm" | "md" | "lg") || "md"}
                        showSeeAll
                        onSeeAll={() => navigate(seeAllRoute)}
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

      {/* Parental Pin Modal */}
      {pinModalContent && profile?.has_parental_pin && user && (
        <ParentalPinModal
          isOpen={!!pinModalContent}
          onClose={() => setPinModalContent(null)}
          onSuccess={() => {
            setPlayingContent({ content: pinModalContent, progress: 0 });
            setPinModalContent(null);
          }}
          userId={user.id}
          contentTitle={pinModalContent.title}
        />
      )}

      {/* Purchase Modal for paid creator content */}
      <PurchaseModal
        open={!!purchaseModalContent}
        onClose={() => setPurchaseModalContent(null)}
        paidContent={purchaseModalContent}
      />

      <SupportChat />
      <PWAInstallBanner />
      <Toaster position="bottom-right" />
      </div>
    </KidsInterface>
  );
};

export default Index;
