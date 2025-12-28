import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { Sidebar } from "@/components/Sidebar";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { MobileContentDetail } from "@/components/mobile/MobileContentDetail";
import { toast } from "sonner";
import { Film, Tv, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ContentFilter = "all" | "movie" | "series";

export default function FreeContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobileDevice, isTablet } = useMobileDevice();
  const isMobile = isMobileDevice || isTablet;
  
  const { data: allContent = [], isLoading } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [filter, setFilter] = useState<ContentFilter>("all");

  // Filter for free content only
  const freeContent = useMemo(() => {
    return allContent
      .filter((c) => !c.isPremium)
      .filter((c) => {
        if (filter === "all") return true;
        return c.contentType === filter;
      })
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [allContent, filter]);

  const handlePlay = (item: Content) => {
    if (item.contentType === "series") {
      navigate(`/content/${item.id}`);
    } else if (item.videoUrl) {
      navigate(`/content/${item.id}?autoplay=true`);
    } else {
      toast.error("This content is not yet available");
    }
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

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading free content..." />
      </div>
    );
  }

  // Mobile view
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <MobileHeader />
        
        <main className="pt-16 px-4">
          <h1 className="text-2xl font-bold mb-4">Free to Watch</h1>
          
          {/* Filter tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className="shrink-0"
            >
              <Filter className="h-4 w-4 mr-1" />
              All
            </Button>
            <Button
              variant={filter === "movie" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("movie")}
              className="shrink-0"
            >
              <Film className="h-4 w-4 mr-1" />
              Movies
            </Button>
            <Button
              variant={filter === "series" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("series")}
              className="shrink-0"
            >
              <Tv className="h-4 w-4 mr-1" />
              TV Shows
            </Button>
          </div>

          {freeContent.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No free content available
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {freeContent.map((item) => (
                <div
                  key={item.id}
                  className="cursor-pointer group"
                  onClick={() => handleDetails(item)}
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary relative">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-active:scale-95 transition-transform"
                      loading="lazy"
                    />
                    <div className="absolute top-1 left-1 bg-green-500/90 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                      FREE
                    </div>
                  </div>
                  <h3 className="mt-1.5 text-sm font-medium truncate">{item.title}</h3>
                </div>
              ))}
            </div>
          )}
        </main>

        <MobileBottomNav />

        {/* Mobile Content Detail Modal */}
        {selectedContent && (
          <MobileContentDetail
            content={selectedContent}
            onClose={() => setSelectedContent(null)}
            onPlay={() => handlePlay(selectedContent)}
            isInList={watchlistIds.includes(selectedContent.id)}
            onToggleList={() => handleToggleList(selectedContent)}
          />
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        currentView="home"
        onNavigate={(view) => navigate(view === "home" ? "/" : `/${view}`)}
        onLogout={() => navigate("/auth")}
      />

      <main className="flex-1 ml-16 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Free to Watch</h1>
            
            {/* Filter tabs */}
            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "movie" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("movie")}
              >
                <Film className="h-4 w-4 mr-1" />
                Movies
              </Button>
              <Button
                variant={filter === "series" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("series")}
              >
                <Tv className="h-4 w-4 mr-1" />
                TV Shows
              </Button>
            </div>
          </div>

          {freeContent.length === 0 ? (
            <p className="text-muted-foreground text-center py-12 text-lg">
              No free content available at the moment
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {freeContent.map((item) => (
                <div
                  key={item.id}
                  className="cursor-pointer group"
                  onClick={() => handleDetails(item)}
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary relative">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-medium">
                      FREE
                    </div>
                  </div>
                  <h3 className="mt-2 font-medium truncate">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.year}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Desktop Content Details Modal */}
      {selectedContent && (
        <ContentDetailsModal
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={() => handlePlay(selectedContent)}
          isInList={watchlistIds.includes(selectedContent.id)}
          onToggleList={() => handleToggleList(selectedContent)}
        />
      )}
    </div>
  );
}
