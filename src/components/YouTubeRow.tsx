import { useRef, useState } from "react";
import { useYouTubePlaylists, useYouTubeVideos } from "@/hooks/useYouTubeChannels";
import { ChevronLeft, ChevronRight, Play, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface YouTubeRowProps {
  title?: string;
  channelId?: string;
  playlistId?: string;
  onPlayVideo?: (videoId: string, title: string) => void;
}

export function YouTubeRow({ 
  title = "Channel Videos", 
  channelId,
  playlistId,
  onPlayVideo 
}: YouTubeRowProps) {
  const navigate = useNavigate();
  const { data: playlists } = useYouTubePlaylists(channelId);
  
  // Get the first playlist if no specific one is provided
  const targetPlaylistId = playlistId || playlists?.[0]?.id;
  const { data: videos, isLoading } = useYouTubeVideos(targetPlaylistId);
  
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

  const handlePlayVideo = (videoId: string, videoTitle: string) => {
    if (onPlayVideo) {
      onPlayVideo(videoId, videoTitle);
    } else {
      navigate(`/youtube?video=${videoId}`);
    }
  };

  if (isLoading) {
    return (
      <section className="py-4">
        <div className="px-4 md:px-12 mb-3">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-4 px-4 md:px-12">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-64 aspect-video bg-muted rounded-lg animate-pulse flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (!videos || videos.length === 0) return null;

  return (
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
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-2 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {videos.map(video => (
            <div
              key={video.id}
              onClick={() => handlePlayVideo(video.video_id, video.title)}
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
                  <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center">
                    <Play className="h-5 w-5 text-white fill-current" />
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
