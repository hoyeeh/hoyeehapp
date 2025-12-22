import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Play, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { YouTubeVideoPlayer } from "./YouTubeVideoPlayer";

interface HomeYouTubeRowProps {
  title?: string;
  maxItems?: number;
}

interface YouTubeChannel {
  id: string;
  name: string;
  channel_id: string;
  thumbnail_url: string | null;
  subscriber_count: string | null;
}

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  playlist_id: string | null;
}

interface ChannelWithVideos extends YouTubeChannel {
  videos: YouTubeVideo[];
}

export function HomeYouTubeRow({ 
  title = "YouTube Channels", 
  maxItems = 10
}: HomeYouTubeRowProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);

  // Fetch YouTube channels with their videos
  const { data: channelsWithVideos, isLoading } = useQuery({
    queryKey: ['home-youtube-channels-with-videos'],
    queryFn: async () => {
      // Get channels that show on desktop
      const { data: channels, error: channelsError } = await supabase
        .from('youtube_channels')
        .select('id, name, channel_id, thumbnail_url, subscriber_count')
        .eq('is_active', true)
        .eq('show_on_desktop', true)
        .order('display_order', { ascending: true })
        .limit(maxItems);
      
      if (channelsError) throw channelsError;
      if (!channels || channels.length === 0) return [];

      // Get playlists for these channels
      const { data: playlists, error: playlistsError } = await supabase
        .from('youtube_playlists')
        .select('id, channel_id')
        .in('channel_id', channels.map(c => c.id))
        .eq('is_active', true);

      if (playlistsError) throw playlistsError;

      // Get videos for all playlists
      const playlistIds = playlists?.map(p => p.id) || [];
      const { data: videos, error: videosError } = await supabase
        .from('youtube_videos')
        .select('id, video_id, title, thumbnail_url, duration, playlist_id')
        .in('playlist_id', playlistIds)
        .order('position', { ascending: true });

      if (videosError) throw videosError;

      // Map videos to channels
      const playlistToChannel = new Map<string, string>();
      playlists?.forEach(p => {
        if (p.channel_id) playlistToChannel.set(p.id, p.channel_id);
      });

      const channelVideosMap = new Map<string, YouTubeVideo[]>();
      videos?.forEach(video => {
        if (video.playlist_id) {
          const channelId = playlistToChannel.get(video.playlist_id);
          if (channelId) {
            const existing = channelVideosMap.get(channelId) || [];
            if (existing.length < 5) { // Limit to 5 videos per channel
              existing.push(video);
              channelVideosMap.set(channelId, existing);
            }
          }
        }
      });

      return channels.map(channel => ({
        ...channel,
        videos: channelVideosMap.get(channel.id) || []
      })) as ChannelWithVideos[];
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

  const handleVideoClick = (video: YouTubeVideo, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlayingVideo({ videoId: video.video_id, title: video.title });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <section className="py-4">
        <div className="px-4 md:px-12 mb-3">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-4 px-4 md:px-12">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-80 h-64 bg-muted rounded-xl animate-pulse flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (!channelsWithVideos || channelsWithVideos.length === 0) return null;

  return (
    <>
      <section className="group/section relative py-4 transition-all duration-300 hover:z-10">
        <div className="px-4 md:px-12 mb-3 flex items-baseline gap-3">
          <h2 className="font-display text-lg md:text-xl lg:text-2xl text-foreground tracking-wide flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            {title}
          </h2>
          <span 
            onClick={() => navigate("/youtube")}
            className="text-brand text-sm font-medium opacity-0 group-hover/section:opacity-100 transition-opacity cursor-pointer hover:underline"
          >
            See All →
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => scroll("left")}
            className={cn(
              "absolute left-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center",
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
              "absolute right-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center",
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
            className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-2 scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {channelsWithVideos.map(channel => (
              <ChannelCard 
                key={channel.id} 
                channel={channel} 
                onVideoClick={handleVideoClick}
                onChannelClick={() => navigate(`/youtube?channel=${channel.channel_id}`)}
                formatDuration={formatDuration}
              />
            ))}
          </div>
        </div>
      </section>

      {playingVideo && (
        <YouTubeVideoPlayer
          videoId={playingVideo.videoId}
          title={playingVideo.title}
          onClose={() => setPlayingVideo(null)}
          autoplay
        />
      )}
    </>
  );
}

interface ChannelCardProps {
  channel: ChannelWithVideos;
  onVideoClick: (video: YouTubeVideo, e: React.MouseEvent) => void;
  onChannelClick: () => void;
  formatDuration: (seconds: number | null) => string;
}

function ChannelCard({ channel, onVideoClick, onChannelClick, formatDuration }: ChannelCardProps) {
  const videoScrollRef = useRef<HTMLDivElement>(null);
  const [videoIndex, setVideoIndex] = useState(0);

  const scrollVideos = (direction: "left" | "right", e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoScrollRef.current) {
      const newIndex = direction === "left" 
        ? Math.max(0, videoIndex - 1) 
        : Math.min(channel.videos.length - 1, videoIndex + 1);
      setVideoIndex(newIndex);
      const videoWidth = 140;
      videoScrollRef.current.scrollTo({
        left: newIndex * videoWidth,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="flex-shrink-0 w-80 md:w-96 rounded-xl bg-card border border-border overflow-hidden group/card hover:border-red-500/50 transition-all duration-300">
      {/* Channel Header */}
      <div 
        onClick={onChannelClick}
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0 border-2 border-transparent group-hover/card:border-red-500 transition-colors">
          {channel.thumbnail_url ? (
            <img
              src={channel.thumbnail_url}
              alt={channel.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-red-700">
              <Youtube className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate group-hover/card:text-red-500 transition-colors">
            {channel.name}
          </h4>
          {channel.subscriber_count && (
            <p className="text-xs text-muted-foreground">{channel.subscriber_count}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View All →
        </span>
      </div>

      {/* Video Carousel */}
      {channel.videos.length > 0 ? (
        <div className="relative px-2 pb-3">
          {channel.videos.length > 2 && videoIndex > 0 && (
            <button
              onClick={(e) => scrollVideos("left", e)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-black transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
          )}
          
          <div
            ref={videoScrollRef}
            className="flex gap-2 overflow-x-hidden scroll-smooth"
          >
            {channel.videos.map((video) => (
              <div
                key={video.id}
                onClick={(e) => onVideoClick(video, e)}
                className="flex-shrink-0 w-32 cursor-pointer group/video"
              >
                <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover/video:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-red-700">
                      <Youtube className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover/video:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-red-600/90 flex items-center justify-center opacity-0 group-hover/video:opacity-100 transition-opacity">
                      <Play className="h-3 w-3 text-white fill-current" />
                    </div>
                  </div>
                  {video.duration && (
                    <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">
                      {formatDuration(video.duration)}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1 group-hover/video:text-foreground transition-colors">
                  {video.title}
                </p>
              </div>
            ))}
          </div>

          {channel.videos.length > 2 && videoIndex < channel.videos.length - 2 && (
            <button
              onClick={(e) => scrollVideos("right", e)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-black transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          )}
        </div>
      ) : (
        <div className="px-3 pb-3">
          <p className="text-xs text-muted-foreground italic">No videos available</p>
        </div>
      )}
    </div>
  );
}
