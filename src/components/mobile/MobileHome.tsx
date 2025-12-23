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

  const [showSearch, setShowSearch] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [scrollY, setScrollY] = useState(0);

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

  // Fetch home sections from database - same as desktop
  const { data: homeSections = [] } = useQuery({
    queryKey: ["mobile-home-sections"],
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

  // Fetch trending
  const { data: trendingData = [], isLoading: isLoadingTrending } = useQuery({
    queryKey: ["mobile-trending"],
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

  // Get section content helper - same logic as desktop
  const getSectionContent = (section: any): Content[] => {
    if (section.section_type === "recently_added") {
      return newContent.slice(0, section.max_items || 15);
    }
    
    if (section.section_type === "genre" && section.genre) {
      return content.filter((c) =>
        c.genre?.toLowerCase().includes(section.genre.name.toLowerCase())
      ).slice(0, section.max_items || 15);
    }
    
    if (section.section_type === "curated") {
      const sectionItems = sectionContentData
        .filter((sc: any) => sc.section_id === section.id && sc.content)
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((sc: any) => transformContent([sc.content])[0]);
      return sectionItems.slice(0, section.max_items || 15);
    }
    
    // Filter by content type if specified
    let filtered = [...content];
    if (section.content_type_filter === "movie") {
      filtered = movies;
    } else if (section.content_type_filter === "series") {
      filtered = series;
    }
    
    return filtered.slice(0, section.max_items || 15);
  };

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

  const handlePlay = (item: Content, progress?: number, episodeId?: string) => {
    // Check kids profile restrictions
    if (currentProfile?.is_kids) {
      const rating = (item as any).contentRating;
      if (rating && !['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G'].includes(rating)) {
        toast.error("This content is not available for Kids profiles");
        return;
      }
    }
    
    // All content requires premium subscription except for admins
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

  const handleDetails = (item: Content) => {
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

          {/* Dynamic sections from database - filtered by activeFilter */}
          {activeFilter !== "all" ? (
            // When filter is active, show filtered content
            <FadeIn delay={100}>
              <MobileContentRow
                title={activeFilter === "series" ? "TV Shows" : "Movies"}
                content={filteredContent}
                onDetails={handleDetails}
                showSeeAll
                onSeeAll={() => navigate("/genres")}
              />
            </FadeIn>
          ) : (
            // When "All" is selected, show all sections
            homeSections.map((section: any, index: number) => {
              // Top 10 section
              if (section.section_type === "top10") {
                return top10Content.length > 0 ? (
                  <FadeIn key={section.id} delay={100 + index * 50}>
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
                  <FadeIn key={section.id} delay={100 + index * 50}>
                    <MobileContentRow
                      title={section.title}
                      content={myListContent}
                      onDetails={handleDetails}
                      showSeeAll
                      onSeeAll={() => navigate("/my-list")}
                    />
                  </FadeIn>
                ) : null;
              }

              // Recently added section
              if (section.section_type === "recently_added") {
                return newContent.length > 0 ? (
                  <FadeIn key={section.id} delay={100 + index * 50}>
                    <MobileContentRow
                      title={section.title}
                      content={newContent.slice(0, section.max_items || 15)}
                      onDetails={handleDetails}
                      showSeeAll
                      onSeeAll={() => navigate("/genres")}
                      isLoading={isLoadingNewReleases}
                    />
                  </FadeIn>
                ) : null;
              }

              // YouTube section
              if (section.section_type === "youtube") {
                return (
                  <FadeIn key={section.id} delay={100 + index * 50}>
                    <MobileHomeYouTubeRow
                      title={section.title}
                      maxItems={section.max_items || 15}
                      cardStyle={section.card_style as "poster" | "backdrop" | "wide" | "square" | "minimal"}
                    />
                  </FadeIn>
                );
              }

              // Genre and other sections
              const sectionContent = getSectionContent(section);
              if (sectionContent.length === 0) return null;

              return (
                <FadeIn key={section.id} delay={100 + index * 50}>
                  <MobileContentRow
                    title={section.title}
                    content={sectionContent}
                    onDetails={handleDetails}
                    showSeeAll
                    onSeeAll={() => navigate("/genres")}
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
                  isLoading={isLoadingNewReleases}
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
    </div>
  );
}
