import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Play, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface HomeYouTubeRowProps {
  title?: string;
  maxItems?: number;
  onPlayVideo?: (videoId: string, title: string) => void;
}

interface YouTubeChannel {
  id: string;
  name: string;
  channel_id: string;
  thumbnail_url: string | null;
  subscriber_count: string | null;
  video_count: number | null;
}

export function HomeYouTubeRow({ 
  title = "YouTube Channels", 
  maxItems = 15,
  onPlayVideo 
}: HomeYouTubeRowProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Fetch YouTube channels that should show on desktop
  const { data: channels, isLoading } = useQuery({
    queryKey: ['home-youtube-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('*')
        .eq('is_active', true)
        .eq('show_on_desktop', true)
        .order('display_order', { ascending: true })
        .limit(maxItems);
      
      if (error) throw error;
      return data as YouTubeChannel[];
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

  const handleChannelClick = (channelId: string) => {
    navigate(`/youtube?channel=${channelId}`);
  };

  if (isLoading) {
    return (
      <section className="py-4">
        <div className="px-4 md:px-12 mb-3">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-4 px-4 md:px-12">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-40 h-40 bg-muted rounded-full animate-pulse flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (!channels || channels.length === 0) return null;

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
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-2 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {channels.map(channel => (
            <div
              key={channel.id}
              onClick={() => handleChannelClick(channel.channel_id)}
              className="flex-shrink-0 w-32 md:w-40 cursor-pointer group text-center"
            >
              <div className="w-24 h-24 md:w-32 md:h-32 mx-auto rounded-full overflow-hidden relative bg-muted border-2 border-transparent group-hover:border-red-500 transition-all duration-300">
                {channel.thumbnail_url ? (
                  <img
                    src={channel.thumbnail_url}
                    alt={channel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-red-700">
                    <Youtube className="h-8 w-8 text-white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-full">
                  <div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center">
                    <Play className="h-4 w-4 text-white fill-current" />
                  </div>
                </div>
              </div>
              <h4 className="mt-2 text-sm font-medium text-foreground line-clamp-2 group-hover:text-red-500 transition-colors">
                {channel.name}
              </h4>
              {channel.subscriber_count && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {channel.subscriber_count}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
