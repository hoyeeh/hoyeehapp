import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { MobileHeader, MobileBottomNav } from "@/components/mobile";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { useYouTubeWatchlist, useToggleWatchlist } from "@/hooks/useYouTubeWatchlist";
import { useYouTubeVideoProgress } from "@/hooks/useYouTubeVideoProgress";
import { YouTubeVideoPlayer } from "@/components/YouTubeVideoPlayer";
import { Clock, Play, Trash2, Youtube, BookmarkX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export default function WatchLater() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const isMobile = useIsMobile();
  const { data: watchlist, isLoading } = useYouTubeWatchlist();
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  if (playingVideo) {
    return (
      <YouTubeVideoPlayer
        videoId={playingVideo.videoId}
        title={playingVideo.title}
        onClose={() => setPlayingVideo(null)}
        onEnded={() => setPlayingVideo(null)}
        autoplay
      />
    );
  }

  const content = (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Watch Later</h1>
        </div>
        <p className="text-muted-foreground">
          {watchlist?.length || 0} videos saved to watch later
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="aspect-video bg-secondary rounded-xl animate-pulse" />
          ))}
        </div>
      ) : watchlist && watchlist.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {watchlist.map(item => (
            <WatchLaterVideoCard
              key={item.id}
              item={item}
              onClick={() => setPlayingVideo({ videoId: item.video_id, title: item.video_title })}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6">
            <Clock className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No videos saved</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Save videos to watch later by clicking the bookmark icon on any YouTube video
          </p>
          <Button onClick={() => navigate("/youtube")} className="gap-2">
            <Youtube className="h-4 w-4" />
            Browse YouTube
          </Button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <MobileHeader />
        {content}
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        currentView="home"
        onNavigate={(view) => {
          navigate(view === "home" ? "/" : `/${view}`);
        }}
        onLogout={handleLogout}
        userName={profile?.display_name}
      />
      <main className="ml-16 md:ml-64 flex-1">
        {content}
      </main>
    </div>
  );
}

interface WatchLaterVideoCardProps {
  item: {
    id: string;
    video_id: string;
    video_title: string;
    thumbnail_url: string | null;
    duration: number | null;
    channel_name: string | null;
  };
  onClick: () => void;
}

function WatchLaterVideoCard({ item, onClick }: WatchLaterVideoCardProps) {
  const toggleWatchlist = useToggleWatchlist();
  const { getProgress } = useYouTubeVideoProgress();
  const progress = getProgress(item.video_id);
  const progressPercent = item.duration && progress ? Math.min(100, (progress / item.duration) * 100) : 0;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWatchlist.mutate({
      videoId: item.video_id,
      videoTitle: item.video_title,
      thumbnailUrl: item.thumbnail_url,
      duration: item.duration,
      channelName: item.channel_name,
      isInWatchlist: true,
    });
  };

  return (
    <div onClick={onClick} className="cursor-pointer group">
      <div className="aspect-video rounded-2xl overflow-hidden relative bg-secondary">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.video_title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Youtube className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        
        {/* Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
            <Play className="h-7 w-7 text-primary-foreground fill-current ml-0.5" />
          </div>
        </div>
        
        {/* Duration Badge */}
        {item.duration && (
          <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
            {formatDuration(item.duration)}
          </div>
        )}

        {/* Remove Button */}
        <button
          onClick={handleRemove}
          disabled={toggleWatchlist.isPending}
          className={cn(
            "absolute top-3 left-3 p-2 rounded-full transition-all",
            "opacity-0 group-hover:opacity-100",
            "bg-destructive/80 text-destructive-foreground hover:bg-destructive"
          )}
          title="Remove from Watch Later"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        
        {/* Video Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Progress Bar */}
          {progressPercent > 0 && (
            <div className="mb-2">
              <Progress value={progressPercent} className="h-1 bg-white/20" />
            </div>
          )}
          
          <h4 className="text-white font-semibold line-clamp-2 text-sm md:text-base">
            {item.video_title}
          </h4>
          <div className="flex items-center justify-between mt-1">
            {item.channel_name && (
              <p className="text-white/60 text-xs">
                {item.channel_name}
              </p>
            )}
            {progressPercent > 0 && (
              <p className="text-primary text-xs font-medium">
                {Math.round(progressPercent)}% watched
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
