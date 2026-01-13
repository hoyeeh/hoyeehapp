import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useContent, useWatchlist, useRemoveFromWatchlist, useProfile } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, Trash2, Loader2, List, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { SecureVideoWrapper } from "@/components/security/SecureVideoWrapper";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileMyList } from "@/components/mobile/MobileMyList";

const MyList = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const { data: allContent = [], isLoading: contentLoading } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const { data: profile } = useProfile();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const [playingContent, setPlayingContent] = useState<Content | null>(null);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  // Return mobile version for mobile devices
  if (isMobile) {
    return <MobileMyList />;
  }

  const myListContent = allContent.filter((c) => watchlistIds.includes(c.id));

  const handleRemove = async (contentId: string) => {
    try {
      await removeFromWatchlist.mutateAsync(contentId);
      toast.success("Removed from My List");
    } catch (error) {
      toast.error("Failed to remove from list");
    }
  };

  const handlePlay = (item: Content) => {
    if (item.isPremium && !profile?.is_subscribed) {
      toast.error("This content requires a premium subscription");
      navigate("/subscription");
      return;
    }
    setPlayingContent(item);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (playingContent) {
    return (
      <SecureVideoWrapper>
        <VideoPlayer
          src={playingContent.videoUrl}
          title={playingContent.title}
          contentId={playingContent.id}
          onBack={() => setPlayingContent(null)}
        />
      </SecureVideoWrapper>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentView="mylist"
        onNavigate={(view) => {
          if (view === "home") navigate("/");
          else if (view === "movies") navigate("/?view=movies");
          else if (view === "shows") navigate("/?view=shows");
        }}
        onLogout={handleLogout}
        userName={profile?.display_name || user.email?.split("@")[0]}
      />

      <main className="ml-16 md:ml-64 p-6 md:p-12">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <List className="h-8 w-8 text-brand" />
            <h1 className="font-display text-3xl md:text-4xl">My List</h1>
          </div>
        </div>

        {contentLoading ? (
          <div className="flex items-center justify-center h-[50vh]">
            <Loader2 className="h-12 w-12 animate-spin text-brand" />
          </div>
        ) : myListContent.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center">
            <List className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-display mb-2">Your list is empty</h2>
            <p className="text-muted-foreground mb-6">
              Add movies and shows to your list to watch them later
            </p>
            <Button variant="brand" onClick={() => navigate("/")}>
              Browse Content
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {myListContent.map((item) => (
              <div
                key={item.id}
                className="group relative bg-card rounded-lg overflow-hidden hover:ring-2 hover:ring-brand transition-all"
              >
                <div 
                  className="aspect-video cursor-pointer"
                  onClick={() => setSelectedContent(item)}
                >
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
                
                <div className="p-4">
                  <h3 className="font-semibold truncate">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.year} • {item.genre} • {item.contentType}
                  </p>
                  
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="brand"
                      size="sm"
                      onClick={() => handlePlay(item)}
                      className="flex-1 gap-1"
                    >
                      <Play className="h-4 w-4" fill="currentColor" />
                      Play
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(item.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedContent && (
        <ContentDetailsModal
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={handlePlay}
          onToggleList={async () => {
            await handleRemove(selectedContent.id);
            setSelectedContent(null);
          }}
          isInList={true}
        />
      )}
    </div>
  );
};

export default MyList;