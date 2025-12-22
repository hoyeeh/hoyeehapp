import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useYouTubeChannels, useYouTubePlaylists, useYouTubeVideos } from "@/hooks/useYouTubeChannels";
import { YouTubeVideoPlayer } from "@/components/YouTubeVideoPlayer";
import { Sidebar } from "@/components/Sidebar";
import { ChevronLeft, ChevronRight, Play, Youtube, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileHeader, MobileBottomNav } from "@/components/mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { data: channels, isLoading: channelsLoading } = useYouTubeChannels();
  const { data: playlists, isLoading: playlistsLoading } = useYouTubePlaylists();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);

  const filteredPlaylists = selectedChannel
    ? playlists?.filter(p => p.channel_id === selectedChannel)
    : playlists;

  // Get featured videos for hero carousel from all playlists
  const allVideosQuery = useYouTubeVideos(playlists?.[0]?.id);
  
  if (channelsLoading || playlistsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
            <Youtube className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading YouTube content...</p>
        </div>
      </div>
    );
  }

  if (playingVideo) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Button
            variant="ghost"
            onClick={() => setPlayingVideo(null)}
            className="mb-6 hover:bg-secondary"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Channels
          </Button>
          <div className="aspect-video max-h-[70vh] w-full">
            <YouTubeVideoPlayer
              videoId={playingVideo.videoId}
              title={playingVideo.title}
              onClose={() => setPlayingVideo(null)}
              autoplay
            />
          </div>
          <div className="mt-6">
            <h1 className="text-2xl font-bold text-foreground">{playingVideo.title}</h1>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <div className="flex-1 overflow-y-auto">
      {/* Hero Carousel Section */}
      <HeroCarousel 
        playlists={playlists || []} 
        onPlayVideo={(videoId, title) => setPlayingVideo({ videoId, title })}
      />

      {/* Channel Filter Pills */}
      <div className="px-4 md:px-8 py-6">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          <Button
            variant={selectedChannel === null ? "default" : "secondary"}
            onClick={() => setSelectedChannel(null)}
            className="shrink-0 rounded-full"
          >
            All Channels
          </Button>
          {channels?.map(channel => (
            <Button
              key={channel.id}
              variant={selectedChannel === channel.id ? "default" : "secondary"}
              onClick={() => setSelectedChannel(channel.id)}
              className="shrink-0 gap-2 rounded-full"
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

      {/* Playlists / Recommended Sections */}
      <div className="px-4 md:px-8 pb-8 space-y-10">
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

// Hero Carousel Component - Uses channel covers with admin banner fallback
interface HeroCarouselProps {
  playlists: Array<{ id: string; title: string; channel_id: string | null }>;
  onPlayVideo: (videoId: string, title: string) => void;
}

function HeroCarousel({ playlists, onPlayVideo }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(1);
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

    // Add channels with cover images (randomized)
    const channelsWithCovers = channels?.filter(c => c.cover_url) || [];
    const shuffledChannels = [...channelsWithCovers].sort(() => Math.random() - 0.5).slice(0, 3);
    
    shuffledChannels.forEach(channel => {
      items.push({
        id: `channel-${channel.id}`,
        type: 'channel',
        title: channel.name,
        subtitle: channel.description?.substring(0, 100) || `${channel.subscriber_count} subscribers`,
        image_url: channel.cover_url!,
        channel_name: channel.name,
        channel_thumbnail: channel.thumbnail_url || undefined
      });
    });

    // Add admin fallback banners
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

    return items.slice(0, 5);
  }, [channels, banners, videos]);

  if (!heroItems.length) {
    return (
      <div className="relative h-[400px] md:h-[500px] bg-gradient-to-b from-secondary/50 to-background flex items-center justify-center">
        <div className="text-center">
          <Youtube className="h-20 w-20 mx-auto text-primary mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">YouTube Channels</h1>
          <p className="text-muted-foreground">Watch curated content from top creators</p>
        </div>
      </div>
    );
  }

  const getCardStyle = (index: number) => {
    const diff = index - activeIndex;
    if (diff === 0) {
      return "z-20 scale-100 opacity-100";
    } else if (Math.abs(diff) === 1) {
      return "z-10 scale-[0.85] opacity-70";
    } else {
      return "z-0 scale-[0.7] opacity-40";
    }
  };

  const getCardTransform = (index: number) => {
    const diff = index - activeIndex;
    const baseTranslate = diff * 280;
    return `translateX(${baseTranslate}px)`;
  };

  const handleItemClick = (item: typeof heroItems[0], isActive: boolean) => {
    if (!isActive) return;
    
    if (item.type === 'video' && item.video_id) {
      onPlayVideo(item.video_id, item.title);
    }
    // For channel and banner types, could navigate to channel page in the future
  };

  return (
    <div className="relative h-[400px] md:h-[500px] bg-gradient-to-b from-secondary/30 to-background overflow-hidden">
      {/* Background Blur */}
      {heroItems[activeIndex]?.image_url && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-3xl scale-110"
          style={{ backgroundImage: `url(${heroItems[activeIndex].image_url})` }}
        />
      )}

      {/* Carousel Container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full max-w-6xl flex items-center justify-center">
          {heroItems.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "absolute transition-all duration-500 ease-out cursor-pointer",
                getCardStyle(index)
              )}
              style={{ transform: getCardTransform(index) }}
              onClick={() => {
                if (index === activeIndex) {
                  handleItemClick(item, true);
                } else {
                  setActiveIndex(index);
                }
              }}
            >
              <div className="w-[320px] md:w-[480px] aspect-video rounded-2xl overflow-hidden shadow-2xl relative group">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                
                {/* Play Button (video type, center card only) */}
                {index === activeIndex && item.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg">
                      <Play className="h-7 w-7 text-primary-foreground fill-current ml-1" />
                    </div>
                  </div>
                )}
                
                {/* Item Info */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                  {/* Channel Avatar for channel type */}
                  {item.type === 'channel' && item.channel_thumbnail && (
                    <div className="flex items-center gap-3 mb-2">
                      <img 
                        src={item.channel_thumbnail} 
                        alt={item.channel_name} 
                        className="w-10 h-10 rounded-full border-2 border-white/20"
                      />
                      <span className="text-white/80 text-sm font-medium">Channel</span>
                    </div>
                  )}
                  
                  {/* Type Badge for banners */}
                  {item.type === 'banner' && (
                    <span className="inline-block px-2 py-1 bg-primary/80 text-primary-foreground text-xs rounded-full mb-2">
                      Featured
                    </span>
                  )}
                  
                  <h3 className="text-white font-bold text-lg md:text-xl line-clamp-2 mb-1">
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <p className="text-white/70 text-sm line-clamp-1">
                      {item.subtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
        disabled={activeIndex === 0}
        className={cn(
          "absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-30",
          "w-12 h-12 rounded-full bg-background/80 backdrop-blur flex items-center justify-center",
          "hover:bg-background transition-all shadow-lg",
          activeIndex === 0 && "opacity-50 cursor-not-allowed"
        )}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={() => setActiveIndex(Math.min(heroItems.length - 1, activeIndex + 1))}
        disabled={activeIndex === heroItems.length - 1}
        className={cn(
          "absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30",
          "w-12 h-12 rounded-full bg-background/80 backdrop-blur flex items-center justify-center",
          "hover:bg-background transition-all shadow-lg",
          activeIndex === heroItems.length - 1 && "opacity-50 cursor-not-allowed"
        )}
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {heroItems.map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              index === activeIndex ? "w-6 bg-primary" : "bg-white/40 hover:bg-white/60"
            )}
          />
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

// Video Card Component with Overlay Text
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
}

function VideoCard({ video, onClick }: VideoCardProps) {
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
