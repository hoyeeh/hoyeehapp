import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useProfile } from "@/hooks/useDatabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { subDays } from "date-fns";
import { toast } from "sonner";

import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileHeroCard } from "./MobileHeroCard";
import { MobileContentRow } from "./MobileContentRow";
import { MobileContinueWatching } from "./MobileContinueWatching";
import { MobileSearchOverlay } from "./MobileSearchOverlay";
import { MobileContentDetail } from "./MobileContentDetail";
import { PullToRefresh } from "./PullToRefresh";
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
  const { data: top10Data = [] } = useQuery({
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
  const { data: trendingData = [] } = useQuery({
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
  const { data: newReleases = [] } = useQuery({
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

  // Featured content for hero
  const featuredContent = top10Content[0] || content[0];

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
    <div className="min-h-screen bg-background flex flex-col">
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
          {/* Hero Card */}
          {featuredContent && (
            <div className="mb-6">
              <MobileHeroCard
                content={featuredContent}
                onPlay={handlePlay}
                onToggleList={handleToggleList}
                onDetails={handleDetails}
                isInList={watchlistIds.includes(featuredContent.id)}
              />
            </div>
          )}

          {/* Continue Watching */}
          <MobileContinueWatching
            onPlay={(c, progress) => handlePlay(c, progress)}
            onDetails={handleDetails}
          />

          {/* New Releases */}
          {newContent.length > 0 && (
            <MobileContentRow
              title="New Releases"
              content={newContent}
              onDetails={handleDetails}
              showSeeAll
            />
          )}

          {/* Top 10 */}
          {top10Content.length > 0 && (
            <MobileContentRow
              title="Top 10 in Hoyeeh"
              content={top10Content}
              onDetails={handleDetails}
              showRank
              variant="poster"
            />
          )}

          {/* Trending */}
          {trending.length > 0 && (
            <MobileContentRow
              title="Trending Now"
              content={trending}
              onDetails={handleDetails}
              variant="landscape"
            />
          )}

          {/* Movies */}
          {movies.length > 0 && (
            <MobileContentRow
              title="Movies"
              content={movies.slice(0, 15)}
              onDetails={handleDetails}
              showSeeAll
              onSeeAll={() => navigate("/genres?type=movie")}
            />
          )}

          {/* Series */}
          {series.length > 0 && (
            <MobileContentRow
              title="TV Series"
              content={series.slice(0, 15)}
              onDetails={handleDetails}
              showSeeAll
              onSeeAll={() => navigate("/genres?type=series")}
            />
          )}

          {/* Genre-based rows */}
          {["Action", "Drama", "Comedy", "Romance"].map((genre) => {
            const genreContent = content.filter((c) =>
              c.genre?.toLowerCase().includes(genre.toLowerCase())
            ).slice(0, 15);
            
            if (genreContent.length === 0) return null;
            
            return (
              <MobileContentRow
                key={genre}
                title={genre}
                content={genreContent}
                onDetails={handleDetails}
                showSeeAll
              />
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
