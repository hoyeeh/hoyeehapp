import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useYouTubeChannels, useYouTubePlaylists, useYouTubeVideos } from "@/hooks/useYouTubeChannels";
import { YouTubeVideoPlayer } from "@/components/YouTubeVideoPlayer";
import { Sidebar } from "@/components/Sidebar";
import { ChevronLeft, ChevronRight, Play, Youtube, Clock, BookmarkPlus, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileHeader, MobileBottomNav } from "@/components/mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { Skeleton } from "@/components/ui/skeleton";
import { useYouTubeWatchlist, useToggleWatchlist, useIsInWatchlist } from "@/hooks/useYouTubeWatchlist";
import { useMobileYouTubePlayer } from "@/contexts/MobileYouTubePlayerContext";
import { ChannelStorySelector } from "@/components/ChannelStorySelector";

// Hook to fetch admin fallback banners
function useYouTubeBanners() {
  return useQuery({
    queryKey: ['youtube-banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youtube_banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });
}
export default function YouTubeChannels() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const isMobile = useIsMobile();
  const { openPlayer: openMobilePlayer } = useMobileYouTubePlayer();
  const { data: channels, isLoading: channelsLoading } = useYouTubeChannels();
  const { data: playlists, isLoading: playlistsLoading } = useYouTubePlaylists();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);

  // Handle video play - use mobile player on mobile, desktop player otherwise
  const handlePlayVideo = (videoId: string, title: string) => {
    if (isMobile) {
      openMobilePlayer({ videoId, title });
    } else {
      setPlayingVideo({ videoId, title });
    }
  };

  const filteredPlaylists = selectedChannel
    ? playlists?.filter(p => p.channel_id === selectedChannel)
    : playlists;

  // Get featured videos for hero carousel from all playlists
  const allVideosQuery = useYouTubeVideos(playlists?.[0]?.id);

  // Find current video details and related videos - MUST be before any returns
  const currentVideoDetails = useMemo(() => {
    if (!playingVideo) return null;
    for (const playlist of playlists || []) {
      // We'll use the hook data if available
    }
    return null;
  }, [playingVideo, playlists]);
  
  if (channelsLoading || playlistsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <Youtube className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading channels...</p>
        </div>
      </div>
    );
  }

  if (playingVideo) {
    return (
      <VideoPlayerPage
        videoId={playingVideo.videoId}
        title={playingVideo.title}
        onClose={() => setPlayingVideo(null)}
        onPlayVideo={(videoId, title) => setPlayingVideo({ videoId, title })}
        playlists={playlists || []}
        channels={channels || []}
      />
    );
  }

  const content = (
    <div className="flex-1 overflow-y-auto">
      {/* Hero Carousel Section */}
      <HeroCarousel 
        playlists={playlists || []} 
        onPlayVideo={handlePlayVideo}
      />

      {/* Channel Stories Selector */}
      <ChannelStorySelector
        channels={channels || []}
        selectedChannel={selectedChannel}
        onSelectChannel={setSelectedChannel}
        allLabel="All Channels"
      />

      {/* Playlists / Recommended Sections */}
      <div className="px-4 md:px-8 pb-8 space-y-10">
        {/* Watch Later Section */}
        <WatchLaterSection onPlayVideo={(videoId, title) => setPlayingVideo({ videoId, title })} />
        
        {filteredPlaylists && filteredPlaylists.length > 0 ? (
          filteredPlaylists.map(playlist => (
            <PlaylistRow
              key={playlist.id}
              playlist={playlist}
              onPlayVideo={(videoId, title) => setPlayingVideo({ videoId, title })}
            />
          ))
        ) : (
          <div className="text-center py-16">
            <Youtube className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No playlists found. Add some through the admin panel.</p>
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

// Hero Carousel Component - Full-width image cover slider
interface HeroCarouselProps {
  playlists: Array<{ id: string; title: string; channel_id: string | null }>;
  onPlayVideo: (videoId: string, title: string) => void;
}

function HeroCarousel({ playlists, onPlayVideo }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { data: channels } = useYouTubeChannels();
  const { data: banners } = useYouTubeBanners();
  const { data: videos } = useYouTubeVideos(playlists[0]?.id);
  
  // Build hero items: prioritize channel covers, then admin banners, then videos
  const heroItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'channel' | 'banner' | 'video';
      title: string;
      subtitle?: string;
      image_url: string;
      video_id?: string;
      channel_name?: string;
      channel_thumbnail?: string;
    }> = [];

    // Add channels with cover images
    const channelsWithCovers = channels?.filter(c => c.cover_url) || [];
    channelsWithCovers.slice(0, 5).forEach(channel => {
      items.push({
        id: `channel-${channel.id}`,
        type: 'channel',
        title: channel.name,
        subtitle: channel.description?.substring(0, 120) || `${channel.subscriber_count} subscribers`,
        image_url: channel.cover_url!,
        channel_name: channel.name,
        channel_thumbnail: channel.thumbnail_url || undefined
      });
    });

    // Add admin banners
    banners?.slice(0, 3).forEach(banner => {
      items.push({
        id: `banner-${banner.id}`,
        type: 'banner',
        title: banner.title,
        subtitle: banner.subtitle || undefined,
        image_url: banner.image_url
      });
    });

    // If we don't have enough items, add featured videos
    if (items.length < 5 && videos?.length) {
      const remainingSlots = 5 - items.length;
      videos.slice(0, remainingSlots).forEach(video => {
        if (video.thumbnail_url) {
          items.push({
            id: `video-${video.id}`,
            type: 'video',
            title: video.title,
            image_url: video.thumbnail_url,
            video_id: video.video_id
          });
        }
      });
    }

    return items.slice(0, 7);
  }, [channels, banners, videos]);

  // Auto-rotate carousel every 6 seconds
  useEffect(() => {
    if (heroItems.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % heroItems.length);
    }, 6000);
    
    return () => clearInterval(interval);
  }, [heroItems.length]);

  const handlePrev = () => {
    setActiveIndex(prev => (prev - 1 + heroItems.length) % heroItems.length);
  };

  const handleNext = () => {
    setActiveIndex(prev => (prev + 1) % heroItems.length);
  };

  const handleItemClick = (item: typeof heroItems[0]) => {
    if (item.type === 'video' && item.video_id) {
      onPlayVideo(item.video_id, item.title);
    }
  };

  if (!heroItems.length) {
    return (
      <div className="relative h-[60vh] md:h-[70vh] bg-gradient-to-b from-secondary/50 to-background flex items-center justify-center">
        <div className="text-center">
          <Youtube className="h-20 w-20 mx-auto text-primary mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Channels</h1>
          <p className="text-muted-foreground">Watch curated content from top creators</p>
        </div>
      </div>
    );
  }

  const currentItem = heroItems[activeIndex];

  return (
    <div className="relative h-[60vh] md:h-[70vh] w-full overflow-hidden">
      {/* Background Images with Crossfade */}
      {heroItems.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-in-out",
            index === activeIndex ? "opacity-100 z-10" : "opacity-0 z-0"
          )}
        >
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </div>
      ))}

      {/* Gradient Overlays */}
      <div className="absolute inset-0 z-20 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="absolute inset-0 z-20 bg-gradient-to-t from-background via-transparent to-black/30" />

      {/* Content Overlay - Bottom Left */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-6 md:p-12 lg:p-16">
        <div className="max-w-3xl">
          {/* Channel Avatar */}
          {currentItem.type === 'channel' && currentItem.channel_thumbnail && (
            <div className="flex items-center gap-3 mb-4 animate-fade-in">
              <img 
                src={currentItem.channel_thumbnail} 
                alt={currentItem.channel_name} 
                className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-white/30 shadow-lg"
              />
              <div>
                <span className="text-white/90 text-sm font-medium">Channel</span>
                <div className="text-white/60 text-xs">{currentItem.channel_name}</div>
              </div>
            </div>
          )}

          {/* Type Badge for banners */}
          {currentItem.type === 'banner' && (
            <span className="inline-block px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full mb-4 animate-fade-in">
              Featured
            </span>
          )}

          {/* Video Badge */}
          {currentItem.type === 'video' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-destructive-foreground text-xs font-semibold rounded-full mb-4 animate-fade-in">
              <Play className="h-3 w-3 fill-current" />
              Video
            </span>
          )}

          {/* Title */}
          <h2 className="text-white font-bold text-2xl md:text-4xl lg:text-5xl line-clamp-2 mb-3 animate-fade-in">
            {currentItem.title}
          </h2>

          {/* Subtitle */}
          {currentItem.subtitle && (
            <p className="text-white/70 text-sm md:text-base lg:text-lg line-clamp-2 mb-6 max-w-2xl animate-fade-in">
              {currentItem.subtitle}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 animate-fade-in">
            {currentItem.type === 'video' && currentItem.video_id && (
              <Button 
                onClick={() => handleItemClick(currentItem)}
                className="bg-white text-black hover:bg-white/90 font-semibold px-6 py-3 text-base"
              >
                <Play className="h-5 w-5 mr-2 fill-current" />
                Play Now
              </Button>
            )}
            {currentItem.type === 'channel' && (
              <Button 
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 font-semibold px-6 py-3 text-base"
              >
                <Youtube className="h-5 w-5 mr-2" />
                View Channel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={handlePrev}
        className={cn(
          "absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-30",
          "w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center",
          "hover:bg-black/60 transition-all border border-white/10",
          "opacity-0 group-hover:opacity-100 hover:opacity-100"
        )}
        style={{ opacity: 1 }}
      >
        <ChevronLeft className="h-6 w-6 md:h-7 md:w-7 text-white" />
      </button>
      <button
        onClick={handleNext}
        className={cn(
          "absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30",
          "w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center",
          "hover:bg-black/60 transition-all border border-white/10",
          "opacity-0 group-hover:opacity-100 hover:opacity-100"
        )}
        style={{ opacity: 1 }}
      >
        <ChevronRight className="h-6 w-6 md:h-7 md:w-7 text-white" />
      </button>

      {/* Dots Indicator - Bottom Center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2 md:hidden">
        {heroItems.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              index === activeIndex 
                ? "w-8 bg-white" 
                : "w-2 bg-white/40 hover:bg-white/60"
            )}
          />
        ))}
      </div>

      {/* Progress Bar - Desktop */}
      <div className="absolute bottom-0 left-0 right-0 z-30 hidden md:flex gap-1 px-12 lg:px-16 pb-6">
        {heroItems.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className="flex-1 h-1 rounded-full overflow-hidden bg-white/20 hover:bg-white/30 transition-colors"
          >
            <div 
              className={cn(
                "h-full bg-white transition-all duration-300",
                index === activeIndex ? "w-full" : "w-0"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// Playlist Row Component
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
      <section>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="w-72 aspect-video rounded-xl flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (!videos || videos.length === 0) return null;

  return (
    <section className="group/section relative">
      {/* Section Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-xl text-foreground">{playlist.title}</h3>
          <span className="text-muted-foreground text-sm px-2 py-0.5 bg-secondary rounded-full">
            {videos.length} videos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className={cn(
              "w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-all",
              !showLeftArrow && "opacity-50 cursor-not-allowed"
            )}
            disabled={!showLeftArrow}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className={cn(
              "w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-all",
              !showRightArrow && "opacity-50 cursor-not-allowed"
            )}
            disabled={!showRightArrow}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Videos Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {videos.map(video => (
          <VideoCard
            key={video.id}
            video={video}
            onClick={() => onPlayVideo(video.video_id, video.title)}
          />
        ))}
      </div>
    </section>
  );
}

// Video Card Component with Overlay Text and Watch Later
interface VideoCardProps {
  video: {
    id: string;
    video_id: string;
    title: string;
    thumbnail_url: string | null;
    duration: number | null;
    view_count: number | null;
  };
  onClick: () => void;
  channelName?: string;
}

function VideoCard({ video, onClick, channelName }: VideoCardProps) {
  const isInWatchlist = useIsInWatchlist(video.video_id);
  const toggleWatchlist = useToggleWatchlist();

  const handleWatchLater = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWatchlist.mutate({
      videoId: video.video_id,
      videoTitle: video.title,
      thumbnailUrl: video.thumbnail_url,
      duration: video.duration,
      channelName: channelName,
      isInWatchlist,
    });
  };

  return (
    <div
      onClick={onClick}
      className="flex-shrink-0 w-72 md:w-80 cursor-pointer group"
    >
      <div className="aspect-video rounded-2xl overflow-hidden relative bg-secondary">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
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
          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
            <Play className="h-6 w-6 text-primary-foreground fill-current ml-0.5" />
          </div>
        </div>
        
        {/* Duration Badge */}
        {video.duration && (
          <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Watch Later Button */}
        <button
          onClick={handleWatchLater}
          className={cn(
            "absolute top-3 left-3 p-2 rounded-full transition-all",
            "opacity-0 group-hover:opacity-100",
            isInWatchlist 
              ? "bg-primary text-primary-foreground" 
              : "bg-black/70 text-white hover:bg-black/90"
          )}
          title={isInWatchlist ? "Remove from Watch Later" : "Add to Watch Later"}
        >
          {isInWatchlist ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <BookmarkPlus className="h-4 w-4" />
          )}
        </button>
        
        {/* Video Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h4 className="text-white font-semibold line-clamp-2 text-sm md:text-base">
            {video.title}
          </h4>
          {video.view_count && video.view_count > 0 && (
            <p className="text-white/60 text-xs mt-1">
              {formatViewCount(video.view_count)} views
            </p>
          )}
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

function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// Watch Later Button Component
interface WatchLaterButtonProps {
  videoId: string;
  videoTitle: string;
  thumbnailUrl?: string | null;
  duration?: number | null;
  channelName?: string | null;
}

function WatchLaterButton({ videoId, videoTitle, thumbnailUrl, duration, channelName }: WatchLaterButtonProps) {
  const isInWatchlist = useIsInWatchlist(videoId);
  const toggleWatchlist = useToggleWatchlist();

  const handleClick = () => {
    toggleWatchlist.mutate({
      videoId,
      videoTitle,
      thumbnailUrl,
      duration,
      channelName,
      isInWatchlist,
    });
  };

  return (
    <Button
      variant={isInWatchlist ? "default" : "secondary"}
      size="sm"
      onClick={handleClick}
      disabled={toggleWatchlist.isPending}
      className="gap-2"
    >
      {isInWatchlist ? (
        <>
          <BookmarkCheck className="h-4 w-4" />
          In Watch Later
        </>
      ) : (
        <>
          <BookmarkPlus className="h-4 w-4" />
          Watch Later
        </>
      )}
    </Button>
  );
}

// Watch Later Section Component
interface WatchLaterSectionProps {
  onPlayVideo: (videoId: string, title: string) => void;
}

function WatchLaterSection({ onPlayVideo }: WatchLaterSectionProps) {
  const { data: watchlist, isLoading } = useYouTubeWatchlist();
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

  // Don't show section if empty or loading
  if (isLoading || !watchlist || watchlist.length === 0) {
    return null;
  }

  return (
    <section className="group/section relative">
      {/* Section Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-xl text-foreground">Watch Later</h3>
          <span className="text-muted-foreground text-sm px-2 py-0.5 bg-secondary rounded-full">
            {watchlist.length} videos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className={cn(
              "w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-all",
              !showLeftArrow && "opacity-50 cursor-not-allowed"
            )}
            disabled={!showLeftArrow}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className={cn(
              "w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-all",
              !showRightArrow && "opacity-50 cursor-not-allowed"
            )}
            disabled={!showRightArrow}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Videos Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {watchlist.map(item => (
          <WatchLaterCard
            key={item.id}
            item={item}
            onClick={() => onPlayVideo(item.video_id, item.video_title)}
          />
        ))}
      </div>
    </section>
  );
}

// Watch Later Card Component
interface WatchLaterCardProps {
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

function WatchLaterCard({ item, onClick }: WatchLaterCardProps) {
  const toggleWatchlist = useToggleWatchlist();

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
    <div
      onClick={onClick}
      className="flex-shrink-0 w-72 md:w-80 cursor-pointer group"
    >
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
          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
            <Play className="h-6 w-6 text-primary-foreground fill-current ml-0.5" />
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
          className="absolute top-3 left-3 p-2 rounded-full bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-all"
          title="Remove from Watch Later"
        >
          <BookmarkCheck className="h-4 w-4" />
        </button>
        
        {/* Video Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h4 className="text-white font-semibold line-clamp-2 text-sm md:text-base">
            {item.video_title}
          </h4>
          {item.channel_name && (
            <p className="text-white/60 text-xs mt-1">
              {item.channel_name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Video Player Page with description, channel info, and related videos
interface VideoPlayerPageProps {
  videoId: string;
  title: string;
  onClose: () => void;
  onPlayVideo: (videoId: string, title: string) => void;
  playlists: Array<{ id: string; title: string; channel_id: string | null }>;
  channels: Array<{ id: string; name: string; thumbnail_url: string | null; subscriber_count: string | null }>;
}

function VideoPlayerPage({ videoId, title, onClose, onPlayVideo, playlists, channels }: VideoPlayerPageProps) {
  const { data: allVideos } = useYouTubeVideos(playlists[0]?.id);
  
  // Find current video details
  const currentVideo = allVideos?.find(v => v.video_id === videoId);
  
  // Get related videos (other videos from the same playlist, excluding current)
  const relatedVideos = allVideos?.filter(v => v.video_id !== videoId).slice(0, 8) || [];
  
  // Find the channel for the current video
  const currentChannel = channels?.[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <Button
          variant="ghost"
          onClick={onClose}
          className="mb-6 hover:bg-secondary"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Channels
        </Button>
        
        {/* Main Video Section - Full Width */}
        <div className="space-y-6">
          <div className="aspect-video max-h-[70vh] w-full">
            <YouTubeVideoPlayer
              videoId={videoId}
              title={title}
              onClose={onClose}
              autoplay
            />
          </div>
          
          {/* Video Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-xl md:text-2xl font-bold text-foreground flex-1">{title}</h1>
              <WatchLaterButton 
                videoId={videoId} 
                videoTitle={title}
                thumbnailUrl={currentVideo?.thumbnail_url}
                duration={currentVideo?.duration}
                channelName={currentChannel?.name}
              />
            </div>
            
            {/* Channel Info */}
            {currentChannel && (
              <div className="flex items-center gap-4 py-4 border-b border-border">
                {currentChannel.thumbnail_url && (
                  <img 
                    src={currentChannel.thumbnail_url} 
                    alt={currentChannel.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-foreground">{currentChannel.name}</h3>
                  {currentChannel.subscriber_count && (
                    <p className="text-sm text-muted-foreground">
                      {currentChannel.subscriber_count} subscribers
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Video Description */}
            {currentVideo?.description && (
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center gap-4 mb-2 text-sm text-muted-foreground">
                  {currentVideo.view_count && currentVideo.view_count > 0 && (
                    <span>{formatViewCount(currentVideo.view_count)} views</span>
                  )}
                  {currentVideo.published_at && (
                    <span>{new Date(currentVideo.published_at).toLocaleDateString()}</span>
                  )}
                </div>
                <p className="text-foreground whitespace-pre-wrap line-clamp-4 text-sm">
                  {currentVideo.description}
                </p>
              </div>
            )}
          </div>
          
          {/* Related Videos - Below Player */}
          <div className="pt-6 border-t border-border">
            <h3 className="font-bold text-lg text-foreground mb-4">Related Videos</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {relatedVideos.map(video => (
                <div 
                  key={video.id}
                  onClick={() => onPlayVideo(video.video_id, video.title)}
                  className="cursor-pointer group"
                >
                  <div className="aspect-video rounded-lg overflow-hidden bg-secondary relative mb-2">
                    {video.thumbnail_url ? (
                      <img 
                        src={video.thumbnail_url} 
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Youtube className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    {video.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                        {formatDuration(video.duration)}
                      </span>
                    )}
                    {/* Play overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-8 w-8 text-white fill-white" />
                    </div>
                  </div>
                  <h4 className="font-medium text-sm line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                    {video.title}
                  </h4>
                  {video.view_count && video.view_count > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatViewCount(video.view_count)} views
                    </p>
                  )}
                </div>
              ))}
            </div>
            
            {relatedVideos.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">
                No related videos found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
