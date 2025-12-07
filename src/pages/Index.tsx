import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useProfile } from "@/hooks/useDatabase";
import { Content, ViewState } from "@/types";
import { LandingPage } from "@/components/LandingPage";
import { Sidebar } from "@/components/Sidebar";
import { HeroBanner } from "@/components/HeroBanner";
import { ContentRow } from "@/components/ContentRow";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  
  const { data: content = [], isLoading: contentLoading } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const { data: profile } = useProfile();
  
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const [currentView, setCurrentView] = useState<ViewState>("home");
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [playingContent, setPlayingContent] = useState<{ content: Content; progress: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

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
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = content.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.genre.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query)
      );
    }
    
    if (currentView === "movies") {
      filtered = filtered.filter((c) => c.contentType === "movie");
    } else if (currentView === "shows") {
      filtered = filtered.filter((c) => c.contentType === "series");
    } else if (currentView === "mylist") {
      filtered = filtered.filter((c) => watchlistIds.includes(c.id));
    }
    
    return filtered;
  };

  const displayContent = getDisplayContent();
  const movies = content.filter((c) => c.contentType === "movie");
  const shows = content.filter((c) => c.contentType === "series");
  const featuredContent = content[0];

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
            {currentView === "home" && !searchQuery && (
              <>
                <HeroBanner
                  content={featuredContent}
                  onPlay={handlePlay}
                  onDetails={handleDetails}
                  onToggleList={handleToggleList}
                  isInList={featuredContent ? watchlistIds.includes(featuredContent.id) : false}
                />
                
                <div className="mt-8">
                  <ContentRow
                    title="Popular Movies"
                    content={movies}
                    onPlay={handlePlay}
                    onToggleList={handleToggleList}
                    onDetails={handleDetails}
                    userList={watchlistIds}
                  />
                  
                  <ContentRow
                    title="TV Shows"
                    content={shows}
                    onPlay={handlePlay}
                    onToggleList={handleToggleList}
                    onDetails={handleDetails}
                    userList={watchlistIds}
                  />
                </div>
              </>
            )}

            {(currentView === "movies" || currentView === "shows" || currentView === "mylist" || searchQuery) && (
              <div className="px-4 md:px-12 pt-4">
                <h1 className="font-display text-3xl md:text-4xl mb-6">
                  {searchQuery
                    ? `Search results for "${searchQuery}"`
                    : currentView === "movies"
                    ? "Movies"
                    : currentView === "shows"
                    ? "TV Shows"
                    : "My List"}
                </h1>
                
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
