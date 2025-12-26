import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Trash2, List, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useContent, useWatchlist, useRemoveFromWatchlist, useProfile } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { toast } from "sonner";
import { useHaptics } from "@/hooks/useHaptics";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileContentDetail } from "./MobileContentDetail";
import { MobileSwipeWrapper } from "./MobileSwipeWrapper";

interface SwipeableItemProps {
  content: Content;
  onRemove: () => void;
  onPlay: () => void;
  onDetails: () => void;
}

function SwipeableItem({ content, onRemove, onPlay, onDetails }: SwipeableItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const { lightTap, warningFeedback } = useHaptics();
  const deleteThreshold = -100;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    // Only allow left swipe
    if (diff < 0) {
      setTranslateX(Math.max(diff, -150));
      
      // Haptic when reaching delete threshold
      if (diff <= deleteThreshold && translateX > deleteThreshold) {
        lightTap();
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    if (translateX <= deleteThreshold) {
      warningFeedback();
      setTranslateX(-150);
      // Auto-remove after showing delete
      setTimeout(() => {
        onRemove();
      }, 200);
    } else {
      setTranslateX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl mb-3">
      {/* Delete Background */}
      <div 
        className={cn(
          "absolute inset-y-0 right-0 w-[150px] bg-destructive flex items-center justify-center",
          "transition-opacity duration-200",
          translateX < -30 ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="flex items-center gap-2 text-destructive-foreground">
          <Trash2 className="h-5 w-5" />
          <span className="font-medium">Remove</span>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={cn(
          "flex gap-3 p-3 bg-secondary/50 transition-transform",
          isDragging ? "" : "duration-300"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => translateX === 0 && onDetails()}
      >
        {/* Thumbnail */}
        <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-secondary flex-shrink-0">
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="w-full h-full object-cover"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="absolute inset-0 flex items-center justify-center bg-background/30 opacity-0 hover:opacity-100 transition-opacity active:opacity-100"
          >
            <div className="w-10 h-10 rounded-full bg-foreground/90 flex items-center justify-center">
              <Play className="h-4 w-4 text-background ml-0.5" fill="currentColor" />
            </div>
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h4 className="text-sm font-semibold line-clamp-1">{content.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {content.year} • {content.contentType === "series" ? "TV Series" : "Movie"}
          </p>
          {content.genre && (
            <p className="text-xs text-muted-foreground/70 line-clamp-1 mt-1">
              {content.genre}
            </p>
          )}
        </div>

        {/* Check Icon */}
        <div className="self-center">
          <Check className="h-5 w-5 text-primary" />
        </div>
      </div>
    </div>
  );
}

export function MobileMyList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: allContent = [], isLoading } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const { data: profile } = useProfile();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const { lightTap, successFeedback } = useHaptics();

  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  const myListContent = allContent.filter((c) => watchlistIds.includes(c.id));

  const handleRemove = async (contentId: string) => {
    try {
      await removeFromWatchlist.mutateAsync(contentId);
      successFeedback();
      toast.success("Removed from My List");
    } catch (error) {
      toast.error("Failed to remove from list");
    }
  };

  const handlePlay = (item: Content) => {
    lightTap();
    if (item.isPremium && !profile?.is_subscribed) {
      toast.error("Premium subscription required");
      navigate("/subscription");
      return;
    }
    navigate(`/content/${item.id}?play=true`);
  };

  const handleBack = () => {
    lightTap();
    navigate(-1);
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <MobileSwipeWrapper>
      <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border/30 pt-safe z-50">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-secondary rounded-xl transition-colors active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <List className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">My List</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        {/* Swipe Hint */}
        {myListContent.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mb-4">
            Swipe left to remove items
          </p>
        )}

        {isLoading ? (
          // Loading skeleton
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3 bg-secondary/30 rounded-xl animate-pulse">
                <div className="w-28 aspect-video rounded-lg bg-secondary" />
                <div className="flex-1 space-y-2 py-2">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : myListContent.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
              <List className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Your List is Empty</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Add movies and shows to your list to watch them later
            </p>
            <button
              onClick={() => {
                lightTap();
                navigate("/");
              }}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium active:scale-95 transition-transform"
            >
              Browse Content
            </button>
          </div>
        ) : (
          <div>
            {myListContent.map((item) => (
              <SwipeableItem
                key={item.id}
                content={item}
                onRemove={() => handleRemove(item.id)}
                onPlay={() => handlePlay(item)}
                onDetails={() => {
                  lightTap();
                  setSelectedContent(item);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <MobileBottomNav />

      {/* Content Detail Modal */}
      {selectedContent && (
        <MobileContentDetail
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={handlePlay}
          isInList={true}
          onToggleList={() => {
            handleRemove(selectedContent.id);
            setSelectedContent(null);
          }}
        />
      )}
    </div>
    </MobileSwipeWrapper>
  );
}
