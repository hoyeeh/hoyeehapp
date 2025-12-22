import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useYouTubeChannels, useYouTubePlaylists, useYouTubeVideos } from "@/hooks/useYouTubeChannels";
import { YouTubeVideoPlayer } from "@/components/YouTubeVideoPlayer";
import { Sidebar } from "@/components/Sidebar";
import { ChevronLeft, ChevronRight, Play, Youtube, Users, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileHeader, MobileBottomNav } from "@/components/mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";

export default function YouTubeChannels() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const isMobile = useIsMobile();
  const { data: channels, isLoading: channelsLoading } = useYouTubeChannels();
  const { data: playlists, isLoading: playlistsLoading } = useYouTubePlaylists();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);

  const filteredPlaylists = selectedChannel
    ? playlists?.filter(p => p.channel_id === selectedChannel)
    : playlists;

  if (channelsLoading || playlistsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading YouTube content...</div>
      </div>
    );
  }

  if (playingVideo) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4">
          <Button
            variant="ghost"
            onClick={() => setPlayingVideo(null)}
            className="mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Channels
          </Button>
          <YouTubeVideoPlayer
            videoId={playingVideo.videoId}
            title={playingVideo.title}
            autoplay
          />
        </div>
      </div>
    );
  }

  const content = (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-red-600 to-red-800 flex items-center justify-center">
        <div className="text-center">
          <Youtube className="h-16 w-16 mx-auto mb-4 text-white" />
          <h1 className="font-display text-3xl md:text-4xl text-white font-bold">
            YouTube Channels
          </h1>
          <p className="text-white/80 mt-2">Watch curated content from top creators</p>
        </div>
      </div>

      {/* Channel Pills */}
      <div className="px-4 md:px-8 py-6 border-b border-border">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          <Button
            variant={selectedChannel === null ? "default" : "outline"}
            onClick={() => setSelectedChannel(null)}
            className="shrink-0"
          >
            All Channels
          </Button>
          {channels?.map(channel => (
            <Button
              key={channel.id}
              variant={selectedChannel === channel.id ? "default" : "outline"}
              onClick={() => setSelectedChannel(channel.id)}
              className="shrink-0 gap-2"
            >
              {channel.thumbnail_url && (
                <img
                  src={channel.thumbnail_url}
                  alt={channel.name}
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              {channel.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Channels Grid */}
      {selectedChannel === null && (
        <div className="px-4 md:px-8 py-8">
          <h2 className="font-display text-xl mb-6">Featured Channels</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {channels?.map(channel => (
              <div
                key={channel.id}
                onClick={() => setSelectedChannel(channel.id)}
                className="bg-card rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all cursor-pointer group"
              >
                <div className="aspect-video bg-muted relative">
                  {channel.thumbnail_url ? (
                    <img
                      src={channel.thumbnail_url}
                      alt={channel.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Youtube className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {channel.name}
                  </h3>
                  {channel.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {channel.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    {channel.subscriber_count && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {channel.subscriber_count}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Video className="h-3 w-3" />
                      {channel.video_count || 0} videos
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Playlists */}
      <div className="px-4 md:px-8 py-8">
        <h2 className="font-display text-xl mb-6">
          {selectedChannel ? "Channel Playlists" : "All Playlists"}
        </h2>
        {filteredPlaylists && filteredPlaylists.length > 0 ? (
          <div className="space-y-8">
            {filteredPlaylists.map(playlist => (
              <PlaylistRow
                key={playlist.id}
                playlist={playlist}
                onPlayVideo={(videoId, title) => setPlayingVideo({ videoId, title })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No playlists found. Add some through the admin panel.
          </div>
        )}
      </div>
    </div>
  );

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

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

interface PlaylistRowProps {
  playlist: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    video_count: number;
  };
  onPlayVideo: (videoId: string, title: string) => void;
}

function PlaylistRow({ playlist, onPlayVideo }: PlaylistRowProps) {
  const { data: videos, isLoading } = useYouTubeVideos(playlist.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 w-48 bg-muted rounded mb-4" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-64 aspect-video bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!videos || videos.length === 0) return null;

  return (
    <section className="group/section relative">
      <div className="mb-3 flex items-baseline gap-3">
        <h3 className="font-display text-lg text-foreground">{playlist.title}</h3>
        <span className="text-muted-foreground text-sm">
          {videos.length} videos
        </span>
      </div>

      <div className="relative">
        <button
          onClick={() => scroll("left")}
          className={cn(
            "absolute left-0 top-0 bottom-0 z-20 w-12 flex items-center justify-center",
            "bg-gradient-to-r from-background via-background/90 to-transparent",
            "transition-all duration-300",
            showLeftArrow ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="w-10 h-10 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-secondary hover:scale-110 transition-all">
            <ChevronLeft className="h-6 w-6" />
          </div>
        </button>

        <button
          onClick={() => scroll("right")}
          className={cn(
            "absolute right-0 top-0 bottom-0 z-20 w-12 flex items-center justify-center",
            "bg-gradient-to-l from-background via-background/90 to-transparent",
            "transition-all duration-300",
            showRightArrow ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="w-10 h-10 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-secondary hover:scale-110 transition-all">
            <ChevronRight className="h-6 w-6" />
          </div>
        </button>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {videos.map(video => (
            <div
              key={video.id}
              onClick={() => onPlayVideo(video.video_id, video.title)}
              className="flex-shrink-0 w-64 md:w-72 cursor-pointer group"
            >
              <div className="aspect-video rounded-lg overflow-hidden relative bg-muted">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Youtube className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
                    <Play className="h-5 w-5 text-primary-foreground fill-current" />
                  </div>
                </div>
                {video.duration && (
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(video.duration)}
                  </div>
                )}
              </div>
              <h4 className="mt-2 text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {video.title}
              </h4>
              {video.view_count > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatViewCount(video.view_count)} views
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
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

function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
