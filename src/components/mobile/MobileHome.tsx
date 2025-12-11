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

// Storage key for persistent random banner
const HERO_BANNER_KEY = "hoyeeh-featured-banner";
const HERO_BANNER_EXPIRY = 6 * 60 * 60 * 1000; // 6 hours

import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileHeroCard, MobileHeroSkeleton } from "./MobileHeroCard";
import { MobileContentRow } from "./MobileContentRow";
import { MobileContinueWatching } from "./MobileContinueWatching";
import { MobileSearchOverlay } from "./MobileSearchOverlay";
import { MobileContentDetail } from "./MobileContentDetail";
import { PullToRefresh } from "./PullToRefresh";
import { FadeIn } from "./PageTransition";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface MobileHomeProps {
  onPlay: (content: Content, progress?: number) => void;
}

export function MobileHome({ onPlay }: MobileHomeProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentProfile } = useProfileContext();
  const { data: content = [], isLoading } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const { data: profile } = useProfile();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

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
    toast.success("Content refreshed!");
  }, [queryClient]);

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

  const handlePlay = (item: Content, progress?: number) => {
    onPlay(item, progress);
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
            <div className="mb-6">
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
            </div>
          </FadeIn>

          {/* Continue Watching */}
          <FadeIn delay={50}>
            <MobileContinueWatching
              onPlay={(c, progress) => handlePlay(c, progress)}
              onDetails={handleDetails}
            />
          </FadeIn>

          {/* New Releases */}
          <FadeIn delay={100}>
            <MobileContentRow
              title="New Releases"
              content={newContent}
              onDetails={handleDetails}
              showSeeAll
              isLoading={isLoadingNewReleases}
            />
          </FadeIn>

          {/* Top 10 */}
          <FadeIn delay={150}>
            <MobileContentRow
              title="Top 10 in Hoyeeh"
              content={top10Content}
              onDetails={handleDetails}
              showRank
              variant="poster"
              isLoading={isLoadingTop10}
            />
          </FadeIn>

          {/* Trending */}
          <FadeIn delay={200}>
            <MobileContentRow
              title="Trending Now"
              content={trending}
              onDetails={handleDetails}
              variant="landscape"
              isLoading={isLoadingTrending}
            />
          </FadeIn>

          {/* Movies */}
          {movies.length > 0 && (
            <FadeIn delay={250}>
              <MobileContentRow
                title="Movies"
                content={movies.slice(0, 15)}
                onDetails={handleDetails}
                showSeeAll
                onSeeAll={() => navigate("/genres?type=movie")}
              />
            </FadeIn>
          )}

          {/* Series */}
          {series.length > 0 && (
            <FadeIn delay={300}>
              <MobileContentRow
                title="TV Series"
                content={series.slice(0, 15)}
                onDetails={handleDetails}
                showSeeAll
                onSeeAll={() => navigate("/genres?type=series")}
              />
            </FadeIn>
          )}

          {/* Genre-based rows */}
          {["Action", "Drama", "Comedy", "Romance"].map((genre, index) => {
            const genreContent = content.filter((c) =>
              c.genre?.toLowerCase().includes(genre.toLowerCase())
            ).slice(0, 15);
            
            if (genreContent.length === 0) return null;
            
            return (
              <FadeIn key={genre} delay={350 + index * 50}>
                <MobileContentRow
                  title={genre}
                  content={genreContent}
                  onDetails={handleDetails}
                  showSeeAll
                />
              </FadeIn>
            );
          })}
        </main>
      </PullToRefresh>

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
          onPlay={(c) => handlePlay(c)}
          onToggleList={handleToggleList}
          isInList={watchlistIds.includes(selectedContent.id)}
        />
      )}
    </div>
  );
}
