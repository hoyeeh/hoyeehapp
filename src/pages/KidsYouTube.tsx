import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { KidsInterface } from "@/components/KidsInterface";
import { KidsEnhancedYouTubePlayer } from "@/components/kids/KidsEnhancedYouTubePlayer";
import { Youtube, Play, Sparkles, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useMobileYouTubePlayer } from "@/contexts/MobileYouTubePlayerContext";
import { cn } from "@/lib/utils";
import { ChannelStorySelector } from "@/components/ChannelStorySelector";
import { KidsLoadingAnimation } from "@/components/kids/KidsLoadingAnimation";

interface YouTubeChannel {
  id: string;
  name: string;
  thumbnail_url: string | null;
  cover_url: string | null;
  kids_category_id: string | null;
  video_count: number;
}

interface YouTubePlaylist {
  id: string;
  channel_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_count: number;
}

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number;
  playlist_id: string;
}

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Video Card Component
function VideoCard({ 
  video, 
  onClick 
}: { 
  video: YouTubeVideo; 
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex-shrink-0 w-[200px] md:w-[280px] cursor-pointer group"
    >
      <div className="aspect-video rounded-2xl overflow-hidden relative bg-gradient-to-br from-violet-500/20 to-fuchsia-600/20">
        <img
          src={video.thumbnail_url || `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        
        {/* Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
            <Play className="h-7 w-7 text-[#0A0A0F] fill-current ml-1" />
          </div>
        </div>
        
        {/* Duration Badge */}
        {video.duration && (
          <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
            {formatDuration(video.duration)}
          </div>
        )}
        
        {/* Video Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h4 className="text-white font-semibold line-clamp-2 text-sm">
            {video.title}
          </h4>
        </div>
      </div>
    </div>
  );
}

// Playlist Row Component - Same pattern as main YouTube page
function PlaylistRow({ 
  playlist, 
  onPlayVideo 
}: { 
  playlist: YouTubePlaylist; 
  onPlayVideo: (videoId: string, title: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Fetch videos for this playlist
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ['kids-youtube-playlist-videos', playlist.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('playlist_id', playlist.id)
        .order('position');
      if (error) throw error;
      return data as YouTubeVideo[];
    },
  });

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
      <section className="space-y-4 bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-purple-500/15 rounded-2xl p-4 md:p-6 border border-violet-500/20">
        <div className="h-6 w-48 bg-white/[0.06] rounded animate-pulse" />
        <div className="flex gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-[200px] md:w-[280px] aspect-video rounded-xl bg-white/[0.06] flex-shrink-0 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (!videos || videos.length === 0) return null;

  return (
    <motion.section 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-4 bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-purple-500/15 rounded-2xl p-4 md:p-6 border border-violet-500/20"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Youtube className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg md:text-xl text-white">{playlist.title}</h3>
            <span className="text-white/50 text-xs">{videos.length} videos</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className={cn(
              "w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all",
              !showLeftArrow && "opacity-50 cursor-not-allowed"
            )}
            disabled={!showLeftArrow}
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <button
            onClick={() => scroll("right")}
            className={cn(
              "w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all",
              !showRightArrow && "opacity-50 cursor-not-allowed"
            )}
            disabled={!showRightArrow}
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Videos Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide"
      >
        {videos.map(video => (
          <VideoCard
            key={video.id}
            video={video}
            onClick={() => onPlayVideo(video.video_id, video.title)}
          />
        ))}
      </div>
    </motion.section>
  );
}

// Channel Selector Component - Kids themed Stories style
function ChannelSelector({ 
  channels, 
  selectedChannel,
  onSelectChannel 
}: { 
  channels: YouTubeChannel[]; 
  selectedChannel: string | null;
  onSelectChannel: (channelId: string | null) => void;
}) {
  if (channels.length === 0) return null;

  return (
    <div className="px-4 md:px-6">
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {/* All Channels Story */}
        <button
          onClick={() => onSelectChannel(null)}
          className="flex flex-col items-center gap-2 flex-shrink-0 group"
        >
          <div
            className={cn(
              "relative w-16 h-16 md:w-20 md:h-20 rounded-full p-[3px] transition-all duration-300",
              selectedChannel === null
                ? "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500"
                : "bg-gradient-to-br from-white/30 to-white/10 group-hover:from-pink-500/60 group-hover:to-red-500/60"
            )}
          >
            <div className="w-full h-full rounded-full bg-[#0A0A0F] p-[2px]">
              <div className={cn(
                "w-full h-full rounded-full flex items-center justify-center font-bold text-xl transition-colors",
                selectedChannel === null
                  ? "bg-gradient-to-br from-pink-500 to-red-500 text-white"
                  : "bg-white/10 text-white/70 group-hover:bg-white/20"
              )}>
                ✦
              </div>
            </div>
          </div>
          <span className={cn(
            "text-xs md:text-sm font-medium max-w-16 md:max-w-20 truncate transition-colors",
            selectedChannel === null ? "text-white" : "text-white/60 group-hover:text-white"
          )}>
            All
          </span>
        </button>

        {/* Channel Stories */}
        {channels.map(channel => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel.id)}
            className="flex flex-col items-center gap-2 flex-shrink-0 group"
          >
            <div
              className={cn(
                "relative w-16 h-16 md:w-20 md:h-20 rounded-full p-[3px] transition-all duration-300",
                selectedChannel === channel.id
                  ? "bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500"
                  : "bg-gradient-to-br from-white/30 to-white/10 group-hover:from-pink-500/60 group-hover:to-red-500/60"
              )}
            >
              <div className="w-full h-full rounded-full bg-[#0A0A0F] p-[2px]">
                {channel.thumbnail_url ? (
                  <img
                    src={channel.thumbnail_url}
                    alt={channel.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className={cn(
                    "w-full h-full rounded-full flex items-center justify-center font-bold text-lg uppercase",
                    selectedChannel === channel.id
                      ? "bg-gradient-to-br from-pink-500 to-red-500 text-white"
                      : "bg-white/10 text-white/70"
                  )}>
                    {channel.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>
            <span className={cn(
              "text-xs md:text-sm font-medium max-w-16 md:max-w-20 truncate transition-colors text-center",
              selectedChannel === channel.id ? "text-white" : "text-white/60 group-hover:text-white"
            )}>
              {channel.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Hero Carousel
function KidsHeroCarousel({ 
  channels,
  onPlayVideo 
}: { 
  channels: YouTubeChannel[];
  onPlayVideo: (videoId: string, title: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Get videos for hero from first few channels
  const { data: heroVideos = [] } = useQuery({
    queryKey: ['kids-hero-videos'],
    queryFn: async () => {
      if (channels.length === 0) return [];
      
      const channelIds = channels.slice(0, 5).map(c => c.id);
      
      // Get playlists from channels
      const { data: playlists } = await supabase
        .from('youtube_playlists')
        .select('id')
        .in('channel_id', channelIds)
        .limit(10);
      
      if (!playlists?.length) return [];
      
      // Get featured videos
      const { data: videos } = await supabase
        .from('youtube_videos')
        .select('*')
        .in('playlist_id', playlists.map(p => p.id))
        .order('view_count', { ascending: false })
        .limit(5);
      
      return videos || [];
    },
    enabled: channels.length > 0,
  });

  // Auto-rotate
  useEffect(() => {
    if (heroVideos.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % heroVideos.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroVideos.length]);

  if (heroVideos.length === 0) {
    return (
      <div className="relative h-[40vh] md:h-[50vh] bg-gradient-to-b from-violet-950/30 to-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-red-500/30 mb-4">
            <Youtube className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Just Kids</h1>
          <p className="text-white/50">Fun videos just for you!</p>
        </div>
      </div>
    );
  }

  const currentVideo = heroVideos[activeIndex];

  return (
    <div className="relative h-[40vh] md:h-[50vh] w-full overflow-hidden">
      {/* Background Image */}
      {heroVideos.map((video: any, index: number) => (
        <div
          key={video.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-in-out",
            index === activeIndex ? "opacity-100 z-10" : "opacity-0 z-0"
          )}
        >
          <img
            src={video.thumbnail_url || `https://img.youtube.com/vi/${video.video_id}/maxresdefault.jpg`}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        </div>
      ))}

      {/* Gradient Overlays */}
      <div className="absolute inset-0 z-20 bg-gradient-to-r from-[#0A0A0F]/90 via-[#0A0A0F]/50 to-transparent" />
      <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#0A0A0F] via-transparent to-[#0A0A0F]/30" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-6 md:p-12">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-full mb-4">
            <Play className="h-3 w-3 fill-current" />
            Video
          </span>
          <h2 className="text-white font-bold text-xl md:text-3xl lg:text-4xl line-clamp-2 mb-4">
            {currentVideo?.title}
          </h2>
          <button 
            onClick={() => onPlayVideo(currentVideo?.video_id, currentVideo?.title)}
            className="inline-flex items-center gap-2 bg-white text-[#0A0A0F] hover:bg-white/90 font-semibold px-6 py-3 rounded-full transition-colors"
          >
            <Play className="h-5 w-5 fill-current" />
            Play Now
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={() => setActiveIndex(prev => (prev - 1 + heroVideos.length) % heroVideos.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-all border border-white/10"
      >
        <ChevronLeft className="h-5 w-5 text-white" />
      </button>
      <button
        onClick={() => setActiveIndex(prev => (prev + 1) % heroVideos.length)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-all border border-white/10"
      >
        <ChevronRight className="h-5 w-5 text-white" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {heroVideos.map((_: any, index: number) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              index === activeIndex ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
            )}
          />
        ))}
      </div>
    </div>
  );
}

const KidsYouTubeContent = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { currentProfile } = useProfileContext();
  const [youtubePlayer, setYoutubePlayer] = useState<{ videoId: string; title: string } | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const mobileYouTubePlayer = useMobileYouTubePlayer();

  // Fetch kids-friendly channels
  const { data: kidsChannels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["kids-youtube-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_channels")
        .select("id, name, thumbnail_url, cover_url, kids_category_id, video_count")
        .eq("is_active", true)
        .eq("is_kids_friendly", true)
        .order("display_order");
      if (error) throw error;
      return data as YouTubeChannel[];
    },
  });

  // Fetch playlists from kids-friendly channels
  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ["kids-youtube-playlists", selectedChannel, kidsChannels],
    queryFn: async () => {
      if (kidsChannels.length === 0) return [];
      
      const channelIds = selectedChannel 
        ? [selectedChannel] 
        : kidsChannels.map(c => c.id);
      
      const { data, error } = await supabase
        .from("youtube_playlists")
        .select("*")
        .in("channel_id", channelIds)
        .order("display_order");
      
      if (error) throw error;
      return data as YouTubePlaylist[];
    },
    enabled: kidsChannels.length > 0,
  });

  const handlePlayVideo = (videoId: string, title: string) => {
    if (isMobile) {
      mobileYouTubePlayer.openPlayer({
        videoId,
        title,
      });
    } else {
      setYoutubePlayer({ videoId, title });
    }
  };

  if (!currentProfile?.is_kids) {
    navigate("/");
    return null;
  }

  const isLoading = channelsLoading || playlistsLoading;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8 pt-4">
        <KidsLoadingAnimation message="Loading videos..." />
      </div>
    );
  }

  if (youtubePlayer) {
    return (
      <KidsEnhancedYouTubePlayer
        videoId={youtubePlayer.videoId}
        title={youtubePlayer.title}
        onClose={() => setYoutubePlayer(null)}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 md:pb-12">
      {/* Hero Carousel */}
      <KidsHeroCarousel channels={kidsChannels} onPlayVideo={handlePlayVideo} />

      {/* Free Badge */}
      <div className="px-4 md:px-6 flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30">
          <Star className="h-4 w-4 text-emerald-400" fill="currentColor" />
          <span className="text-sm font-semibold text-emerald-300">All Free to Watch!</span>
        </div>
      </div>

      {/* Channel Filter Pills */}
      <ChannelSelector 
        channels={kidsChannels} 
        selectedChannel={selectedChannel}
        onSelectChannel={setSelectedChannel}
      />

      {/* Playlists */}
      <div className="px-4 md:px-6 space-y-8">
        {playlists.length > 0 ? (
          playlists.map(playlist => (
            <PlaylistRow
              key={playlist.id}
              playlist={playlist}
              onPlayVideo={handlePlayVideo}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mb-6 shadow-2xl shadow-red-500/30">
              <Youtube className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3 tracking-[-0.02em]">Videos Coming Soon</h2>
            <p className="text-[15px] text-white/50 font-medium">Check back soon for fun videos!</p>
          </div>
        )}
      </div>
    </div>
  );
};

const KidsYouTube = () => {
  return (
    <KidsInterface>
      <KidsYouTubeContent />
    </KidsInterface>
  );
};

export default KidsYouTube;
