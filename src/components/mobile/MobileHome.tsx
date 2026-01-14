import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useProfile } from "@/hooks/useDatabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { subDays } from "date-fns";
import { toast } from "sonner";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { useMobileVideoPlayer } from "@/contexts/MobileVideoPlayerContext";
import { useLatestTVShowUpdates } from "@/hooks/useLatestTVShowUpdates";

// Storage key for persistent random banner
const HERO_BANNER_KEY = "hoyeeh-featured-banner";
const HERO_BANNER_EXPIRY = 6 * 60 * 60 * 1000; // 6 hours

import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileHeroCard, MobileHeroSkeleton } from "./MobileHeroCard";
import { MobileContentRow } from "./MobileContentRow";
import { MobileOfflineContinueWatching } from "./MobileOfflineContinueWatching";
import { MobileSearchOverlay } from "./MobileSearchOverlay";
import { MobileContentDetail } from "./MobileContentDetail";
import { PullToRefresh } from "./PullToRefresh";
import { FadeIn } from "./PageTransition";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MobileCastStatusIndicator } from "./MobileCastStatusIndicator";
import { MobileHomeYouTubeRow } from "./MobileHomeYouTubeRow";
import { MobileRecentlyWatched } from "./MobileRecentlyWatched";
import { MobileAIRecommendations } from "./MobileAIRecommendations";
import { MobileBecauseYouWatchedRow } from "./MobileBecauseYouWatchedRow";
import { PurchaseModal } from "@/components/creator/PurchaseModal";
import { MobilePaidContentRow } from "./MobilePaidContentRow";
import { MobilePurchasesShortcut } from "./MobilePurchasesShortcut";
import { MobileComingSoonRow } from "./MobileComingSoonRow";
import { MobileSwipeWrapper } from "./MobileSwipeWrapper";
import { MobilePlayablesRow } from "@/components/playables/MobilePlayablesRow";

export function MobileHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentProfile } = useProfileContext();
  const { data: content = [], isLoading } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const { data: profile } = useProfile();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const { canAccessPremium, isLoading: subscriptionLoading } = useSubscriptionAccess();
  const mobilePlayer = useMobileVideoPlayer();

  // Get TV show content IDs for new episode/season badges
  const tvShowIds = useMemo(() => 
    content.filter(c => c.contentType === 'series').map(c => c.id),
    [content]
  );
  const { data: tvShowUpdates = {} } = useLatestTVShowUpdates(tvShowIds);

  const [showSearch, setShowSearch] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [scrollY, setScrollY] = useState(0);
  const [purchaseModalContent, setPurchaseModalContent] = useState<any>(null);
  const [checkingPaidContentId, setCheckingPaidContentId] = useState<string | null>(null);

  // Track scroll for header transparency
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["content"] });
    await queryClient.invalidateQueries({ queryKey: ["mobile-top-10"] });
    await queryClient.invalidateQueries({ queryKey: ["mobile-trending"] });
    await queryClient.invalidateQueries({ queryKey: ["mobile-new-releases"] });
    await queryClient.invalidateQueries({ queryKey: ["mobile-continue-watching"] });
    await queryClient.invalidateQueries({ queryKey: ["mobile-home-sections"] });
    toast.success("Content refreshed!");
  }, [queryClient]);

  // Fetch home sections from database - filter for mobile display
  const { data: homeSections = [] } = useQuery({
    queryKey: ["mobile-home-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_sections")
        .select("*, genre:genre_id(name)")
        .eq("is_active", true)
        .eq("show_on_mobile", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch global deduplication setting
  const { data: deduplicationSetting } = useQuery({
    queryKey: ["mobile-home-deduplication-setting"],
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
    queryKey: ["mobile-section-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_content")
        .select("*, content:content_id(*)");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch Top 10
  const { data: top10Data = [], isLoading: isLoadingTop10 } = useQuery({
    queryKey: ["mobile-top-10"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top_10")
        .select(`id, rank, content:content_id (id, title, description, thumbnail_url, video_url, genre, content_type, is_premium, duration, year)`)
        .order("rank")
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch trending - Top 20 for "What to Watch"
  const { data: trendingData = [], isLoading: isLoadingTrending } = useQuery({
    queryKey: ["mobile-trending"],
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

  // Fetch new releases
  const { data: newReleases = [], isLoading: isLoadingNewReleases } = useQuery({
    queryKey: ["mobile-new-releases"],
    queryFn: async () => {
      const twoWeeksAgo = subDays(new Date(), 14).toISOString();
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .gte("created_at", twoWeeksAgo)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
  });

  // Transform data
  const transformContent = (items: any[]): Content[] =>
    items.map((item) => ({
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
      createdAt: item.created_at,
    }));

  const top10Content = top10Data
    .filter((item: any) => item.content)
    .map((item: any) => transformContent([item.content])[0]);

  const trending = transformContent(trendingData);
  const newContent = transformContent(newReleases);

  // Filter content
  const filteredContent = content.filter((c) => {
    if (activeFilter === "series") return c.contentType === "series";
    if (activeFilter === "movie") return c.contentType === "movie";
    return true;
  });

  const movies = content.filter((c) => c.contentType === "movie");
  const series = content.filter((c) => c.contentType === "series");

  // Get raw section content helper (before deduplication)
  const getRawSectionContent = (section: any): Content[] => {
    if (section.section_type === "recently_added") {
      // Sort by created_at (already sorted from query), then by year
      return newContent.slice(0, section.max_items || 15);
    }
    
    if (section.section_type === "genre" && section.genre) {
      return content
        .filter((c) => c.genre?.toLowerCase().includes(section.genre.name.toLowerCase()))
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, section.max_items || 15);
    }
    
    if (section.section_type === "curated") {
      const sectionItems = sectionContentData
        .filter((sc: any) => sc.section_id === section.id && sc.content)
        .map((sc: any) => transformContent([sc.content])[0])
        .sort((a: Content, b: Content) => (b.year || 0) - (a.year || 0));
      return sectionItems.slice(0, section.max_items || 15);
    }
    
    if (section.section_type === "by_year") {
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
    }
    
    // Filter by content type if specified and sort by year
    let filtered = [...content];
    if (section.content_type_filter === "movie") {
      filtered = movies;
    } else if (section.content_type_filter === "series") {
      filtered = series;
    }
    
    // Handle free_content section type
    if (section.section_type === "free_content") {
      // Check if curated
      if (section.is_curated) {
        const curatedFree = sectionContentData
          .filter((sc: any) => sc.section_id === section.id && sc.content && !sc.content.is_premium)
          .map((sc: any) => transformContent([sc.content])[0]);
        return curatedFree.slice(0, section.max_items || 15);
      }
      let freeFiltered = content.filter((c) => !c.isPremium);
      if (section.content_type_filter === "movie") {
        freeFiltered = freeFiltered.filter((c) => c.contentType === "movie");
      } else if (section.content_type_filter === "series") {
        freeFiltered = freeFiltered.filter((c) => c.contentType === "series");
      }
      return freeFiltered
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, section.max_items || 15);
    }
    
    // Handle series section type with genre and year filters
    if (section.section_type === "series") {
      let seriesFiltered = series;
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
    }
    
    return filtered
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, section.max_items || 15);
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
  }, [homeSections, content, newContent, sectionContentData, movies, series, enableDeduplication]);

  // Random persistent featured content for hero
  const featuredContent = useMemo(() => {
    // Combine all featured-worthy content
    const allFeatured = [...top10Content, ...trending.slice(0, 5), ...newContent.slice(0, 5)];
    if (allFeatured.length === 0) return content[0];

    // Check localStorage for persisted selection
    try {
      const stored = localStorage.getItem(HERO_BANNER_KEY);
      if (stored) {
        const { contentId, timestamp } = JSON.parse(stored);
        // Check if not expired
        if (Date.now() - timestamp < HERO_BANNER_EXPIRY) {
          const found = allFeatured.find((c) => c.id === contentId);
          if (found) return found;
        }
      }
    } catch {}

    // Select random content and persist
    const randomIndex = Math.floor(Math.random() * allFeatured.length);
    const selected = allFeatured[randomIndex];
    
    try {
      localStorage.setItem(
        HERO_BANNER_KEY,
        JSON.stringify({ contentId: selected.id, timestamp: Date.now() })
      );
    } catch {}

    return selected;
  }, [top10Content, trending, newContent, content]);

  const handlePlay = async (item: Content, progress?: number, episodeId?: string) => {
    // Check kids profile restrictions
    if (currentProfile?.is_kids) {
      const rating = (item as any).contentRating;
      if (rating && !['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G'].includes(rating)) {
        toast.error("This content is not available for Kids profiles");
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
    
    // Check subscription for non-creator content
    if (!canAccessPremium) {
      toast.error("Subscribe to watch this content");
      navigate("/subscription");
      return;
    }
    
    // For episodes, navigate to content detail with episode autoplay
    if (episodeId) {
      navigate(`/content/${item.id}?episode=${episodeId}&autoplay=true`);
      return;
    }
    
    // For movies, use mobile player directly
    if (item.contentType === "movie" && item.videoUrl) {
      mobilePlayer.openPlayer({
        content: item,
        videoUrl: item.videoUrl,
        title: item.title,
        thumbnail: item.thumbnailUrl,
        resumeAt: progress,
      });
      return;
    }
    
    // For series without episodeId, navigate to content detail
    if (item.contentType === "series") {
      navigate(`/content/${item.id}`);
      return;
    }
    
    // Fallback - navigate to content detail
    navigate(`/content/${item.id}`);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  console.log('[MobileHome] Rendering, content count:', content.length);

  return (
    <MobileSwipeWrapper>
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <MobileHeader
          onSearchClick={() => setShowSearch(true)}
          transparent={scrollY < 100}
          showFilters={true}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </div>

      {/* Main Content - Scrollable area with pull to refresh */}
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="flex-1 pt-28 pb-24">
          {/* Hero Card with loading skeleton */}
          <FadeIn delay={0}>
            {isLoadingTop10 && !featuredContent ? (
              <MobileHeroSkeleton />
            ) : featuredContent ? (
              <MobileHeroCard
                content={featuredContent}
                onPlay={handlePlay}
                onToggleList={handleToggleList}
                onDetails={handleDetails}
                isInList={watchlistIds.includes(featuredContent.id)}
                videoPreviewUrl={featuredContent.videoUrl}
              />
            ) : null}
          </FadeIn>

          {/* Continue Watching - Offline-first */}
          <FadeIn delay={50}>
            <MobileOfflineContinueWatching
              onPlay={(c, progress, episodeId) => handlePlay(c, progress, episodeId)}
              onDetails={handleDetails}
            />
          </FadeIn>

          {/* My Purchases Shortcut */}
          <FadeIn delay={60}>
            <MobilePurchasesShortcut onDetails={handleDetails} />
          </FadeIn>

          {/* Recently Watched - Completed content for rewatching */}
          <FadeIn delay={75}>
            <MobileRecentlyWatched
              onPlay={handlePlay}
              onDetails={handleDetails}
            />
          </FadeIn>

          {/* AI Recommendations - Smart picks based on watch history */}
          <FadeIn delay={100}>
            <MobileAIRecommendations onDetails={handleDetails} />
          </FadeIn>

          {/* Because You Watched Row */}
          <FadeIn delay={125}>
            <MobileBecauseYouWatchedRow onDetails={handleDetails} />
          </FadeIn>

          {/* Coming Soon Row */}
          <FadeIn delay={135}>
            <MobileComingSoonRow />
          </FadeIn>

          {/* Hoyeeh Playables Row */}
          <FadeIn delay={140}>
            <MobilePlayablesRow />
          </FadeIn>

          {/* Dynamic sections from database - filtered by activeFilter */}
          {activeFilter !== "all" ? (
            // When filter is active, show filtered content
            <FadeIn delay={150}>
              <MobileContentRow
                title={activeFilter === "series" ? "TV Shows" : "Movies"}
                content={filteredContent}
                onDetails={handleDetails}
                showSeeAll
                onSeeAll={() => navigate("/genres")}
                tvShowUpdates={tvShowUpdates}
              />
            </FadeIn>
          ) : (
            // When "All" is selected, show all sections with deduplication
            processedHomeSections.map(({ section, content: sectionContent }, index) => {
              // Top 10 section
              if (section.section_type === "top10") {
                return top10Content.length > 0 ? (
                  <FadeIn key={section.id} delay={150 + index * 50}>
                    <MobileContentRow
                      title={section.title}
                      content={top10Content}
                      onDetails={handleDetails}
                      showRank
                      variant="poster"
                      isLoading={isLoadingTop10}
                    />
                  </FadeIn>
                ) : null;
              }

              // My List section
              if (section.section_type === "my_list") {
                const myListContent = content.filter((c) => watchlistIds.includes(c.id));
                return myListContent.length > 0 ? (
                  <FadeIn key={section.id} delay={150 + index * 50}>
                    <MobileContentRow
                      title={section.title}
                      content={myListContent}
                      onDetails={handleDetails}
                      showSeeAll
                      onSeeAll={() => navigate("/my-list")}
                      tvShowUpdates={tvShowUpdates}
                    />
                  </FadeIn>
                ) : null;
              }

              // Recently added section - use processed content (sorted by created_at)
              if (section.section_type === "recently_added") {
                return sectionContent.length > 0 ? (
                  <FadeIn key={section.id} delay={150 + index * 50}>
                    <MobileContentRow
                      title={section.title}
                      content={sectionContent}
                      onDetails={handleDetails}
                      showSeeAll
                      onSeeAll={() => navigate("/genres")}
                      showNewBadge={true}
                      isLoading={isLoadingNewReleases}
                      tvShowUpdates={tvShowUpdates}
                    />
                  </FadeIn>
                ) : null;
              }

              // YouTube section
              if (section.section_type === "youtube") {
                return (
                  <FadeIn key={section.id} delay={150 + index * 50}>
                    <MobileHomeYouTubeRow
                      title={section.title}
                      maxItems={section.max_items || 15}
                      cardStyle={section.card_style as "poster" | "backdrop" | "wide" | "square" | "minimal"}
                    />
                  </FadeIn>
                );
              }

              // Creator Studio / Paid Content section
              if (section.section_type === "creator_store") {
                return (
                  <FadeIn key={section.id} delay={150 + index * 50}>
                    <MobilePaidContentRow
                      title={section.title}
                      onDetails={handleDetails}
                      maxItems={section.max_items || 15}
                    />
                  </FadeIn>
                );
              }

              // Continue watching section - handled above, skip in dynamic sections
              if (section.section_type === "continue_watching") {
                return null;
              }

              // Genre and other sections - use processed deduplicated content
              if (sectionContent.length === 0) return null;

              // Determine the appropriate "See All" destination based on section type
              const seeAllRoute = section.section_type === "free_content" 
                ? "/free-content" 
                : "/genres";

              return (
                <FadeIn key={section.id} delay={150 + index * 50}>
                  <MobileContentRow
                    title={section.title}
                    content={sectionContent}
                    onDetails={handleDetails}
                    showSeeAll
                    onSeeAll={() => navigate(seeAllRoute)}
                    tvShowUpdates={tvShowUpdates}
                  />
                </FadeIn>
              );
            })
          )}

          {/* Fallback sections if no home_sections configured */}
          {homeSections.length === 0 && (
            <>
              <FadeIn delay={100}>
                <MobileContentRow
                  title="Recently Added"
                  content={newContent}
                  onDetails={handleDetails}
                  showSeeAll
                  onSeeAll={() => navigate("/genres")}
                  showNewBadge={true}
                  isLoading={isLoadingNewReleases}
                  tvShowUpdates={tvShowUpdates}
                />
              </FadeIn>

              <FadeIn delay={150}>
                <MobileContentRow
                  title="Top 10 Today"
                  content={top10Content}
                  onDetails={handleDetails}
                  showRank
                  variant="poster"
                  isLoading={isLoadingTop10}
                />
              </FadeIn>

              <FadeIn delay={200}>
                <MobileContentRow
                  title="Trending Now"
                  content={trending}
                  onDetails={handleDetails}
                  variant="landscape"
                  isLoading={isLoadingTrending}
                  tvShowUpdates={tvShowUpdates}
                />
              </FadeIn>
            </>
          )}
        </main>
      </PullToRefresh>

      {/* Cast Status Indicator - shows when actively casting */}
      <MobileCastStatusIndicator />

      {/* Bottom Navigation - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <MobileBottomNav />
      </div>

      {/* Search Overlay */}
      <MobileSearchOverlay
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={handleDetails}
      />

      {/* Content Detail Modal */}
      {selectedContent && (
        <MobileContentDetail
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={() => {}}
          onToggleList={handleToggleList}
          isInList={watchlistIds.includes(selectedContent.id)}
        />
      )}

      {/* Purchase Modal for paid creator content */}
      <PurchaseModal
        open={!!purchaseModalContent}
        onClose={() => setPurchaseModalContent(null)}
        paidContent={purchaseModalContent}
      />
    </div>
    </MobileSwipeWrapper>
  );
}
