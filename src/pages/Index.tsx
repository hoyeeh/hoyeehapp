import { useState, useEffect } from "react";
import { User, Content, ViewState, ToastState } from "@/types";
import { mockContent, featuredContent } from "@/data/mockContent";
import { LandingPage } from "@/components/LandingPage";
import { AuthForm } from "@/components/AuthForm";
import { Sidebar } from "@/components/Sidebar";
import { HeroBanner } from "@/components/HeroBanner";
import { ContentRow } from "@/components/ContentRow";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [initialEmail, setInitialEmail] = useState("");
  
  const [currentView, setCurrentView] = useState<ViewState>("home");
  const [content, setContent] = useState<Content[]>(mockContent);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [playingContent, setPlayingContent] = useState<{ content: Content; progress: number } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Check for stored user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("hoyeeh_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem("hoyeeh_user", JSON.stringify(userData));
    setShowAuth(false);
    toast.success(`Welcome to Hoyeeh, ${userData.name || "User"}!`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("hoyeeh_user");
    setShowAuth(false);
    setCurrentView("home");
    setPlayingContent(null);
    setSelectedContent(null);
    toast.info("You have been signed out");
  };

  const handleToggleList = (item: Content) => {
    if (!user) return;
    
    const isInList = user.myList?.includes(item.id);
    const updatedList = isInList
      ? user.myList.filter((id) => id !== item.id)
      : [...(user.myList || []), item.id];
    
    const updatedUser = { ...user, myList: updatedList };
    setUser(updatedUser);
    localStorage.setItem("hoyeeh_user", JSON.stringify(updatedUser));
    
    toast.success(isInList ? "Removed from My List" : "Added to My List");
  };

  const handlePlay = (item: Content) => {
    if (item.isPremium && !user?.isSubscribed) {
      toast.error("This content requires a premium subscription");
      return;
    }
    setSelectedContent(null);
    setPlayingContent({ content: item, progress: 0 });
  };

  const handleDetails = (item: Content) => {
    setSelectedContent(item);
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
      filtered = filtered.filter((c) => user?.myList?.includes(c.id));
    }
    
    return filtered;
  };

  const displayContent = getDisplayContent();
  const movies = content.filter((c) => c.contentType === "movie");
  const shows = content.filter((c) => c.contentType === "series");

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
    if (showAuth) {
      return (
        <AuthForm
          onSuccess={handleLogin}
          onBack={() => setShowAuth(false)}
          initialEmail={initialEmail}
        />
      );
    }
    
    return (
      <LandingPage
        onSignIn={() => setShowAuth(true)}
        onGetStarted={(email) => {
          setInitialEmail(email || "");
          setShowAuth(true);
        }}
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
        userName={user.name}
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

        {/* Content */}
        <div className="pb-8">
          {currentView === "home" && !searchQuery && (
            <>
              <HeroBanner
                content={featuredContent}
                onPlay={handlePlay}
                onDetails={handleDetails}
                onToggleList={handleToggleList}
                isInList={user?.myList?.includes(featuredContent.id) || false}
              />
              
              <div className="mt-8">
                <ContentRow
                  title="Popular Movies"
                  content={movies}
                  onPlay={handlePlay}
                  onToggleList={handleToggleList}
                  onDetails={handleDetails}
                  userList={user?.myList}
                />
                
                <ContentRow
                  title="TV Shows"
                  content={shows}
                  onPlay={handlePlay}
                  onToggleList={handleToggleList}
                  onDetails={handleDetails}
                  userList={user?.myList}
                />
                
                <ContentRow
                  title="Continue Watching"
                  content={movies.slice(0, 3)}
                  onPlay={handlePlay}
                  onToggleList={handleToggleList}
                  onDetails={handleDetails}
                  userList={user?.myList}
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
      </main>

      {/* Content Details Modal */}
      {selectedContent && (
        <ContentDetailsModal
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={handlePlay}
          onToggleList={handleToggleList}
          isInList={user?.myList?.includes(selectedContent.id) || false}
        />
      )}

      <Toaster position="bottom-right" />
    </div>
  );
};

export default Index;
