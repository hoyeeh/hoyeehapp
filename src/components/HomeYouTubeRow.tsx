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
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal";
  onPlayVideo?: (videoId: string, title: string) => void;
}

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number | null;
}

// Get card dimensions based on style
const getCardStyles = (style: string) => {
  switch (style) {
    case "poster":
      return { container: "w-36 md:w-44", aspect: "aspect-[2/3]" };
    case "backdrop":
      return { container: "w-64 md:w-72", aspect: "aspect-video" };
    case "wide":
      return { container: "w-52 md:w-60", aspect: "aspect-[4/3]" };
    case "square":
      return { container: "w-40 md:w-48", aspect: "aspect-square" };
    case "minimal":
      return { container: "w-48 md:w-56", aspect: "aspect-video" };
    default:
      return { container: "w-64 md:w-72", aspect: "aspect-video" };
  }
};

export function HomeYouTubeRow({ 
  title = "YouTube Videos", 
  maxItems = 15,
  cardStyle = "backdrop",
  onPlayVideo 
}: HomeYouTubeRowProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);

  // Fetch YouTube videos from channels that should show on desktop
  const { data: videos, isLoading } = useQuery({
    queryKey: ['home-youtube-videos'],
    queryFn: async () => {
      // First get channels that show on desktop
      const { data: channels, error: channelsError } = await supabase
        .from('youtube_channels')
        .select('id')
        .eq('is_active', true)
        .eq('show_on_desktop', true);
      
      if (channelsError) throw channelsError;
      if (!channels || channels.length === 0) return [];

      const channelIds = channels.map(c => c.id);

      // Get playlists from those channels
      const { data: playlists, error: playlistsError } = await supabase
        .from('youtube_playlists')
        .select('id')
        .in('channel_id', channelIds)
        .eq('is_active', true);

      if (playlistsError) throw playlistsError;
      if (!playlists || playlists.length === 0) return [];

      const playlistIds = playlists.map(p => p.id);

      // Get videos from those playlists
      const { data: videosData, error: videosError } = await supabase
        .from('youtube_videos')
        .select('*')
        .in('playlist_id', playlistIds)
        .order('published_at', { ascending: false })
        .limit(maxItems);

      if (videosError) throw videosError;
      return videosData as YouTubeVideo[];
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

  const handleVideoClick = (video: YouTubeVideo) => {
    if (onPlayVideo) {
      onPlayVideo(video.video_id, video.title);
    } else {
      setPlayingVideo({ videoId: video.video_id, title: video.title });
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViewCount = (count: number | null) => {
    if (!count) return "";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`;
    return `${count} views`;
  };

  if (isLoading) {
    return (
      <section className="py-4">
        <div className="px-4 md:px-12 mb-3">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-4 px-4 md:px-12">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-64 h-36 bg-muted rounded-lg animate-pulse flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (!videos || videos.length === 0) return null;

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
            {videos.map(video => {
              const styles = getCardStyles(cardStyle);
              return (
                <div
                  key={video.id}
                  onClick={() => handleVideoClick(video)}
                  className={cn("flex-shrink-0 cursor-pointer group", styles.container)}
                >
                  <div className={cn("relative rounded-lg overflow-hidden bg-muted", styles.aspect)}>
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-red-700">
                        <Youtube className="h-12 w-12 text-white" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="w-14 h-14 rounded-full bg-red-600/90 flex items-center justify-center">
                        <Play className="h-6 w-6 text-white fill-current" />
                      </div>
                    </div>
                    {video.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                  </div>
                  <h4 className="mt-2 text-sm font-medium text-foreground line-clamp-2 group-hover:text-red-500 transition-colors">
                    {video.title}
                  </h4>
                  {video.view_count && cardStyle !== "minimal" && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatViewCount(video.view_count)}
                    </p>
                  )}
                </div>
              );
            })}
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
