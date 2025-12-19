import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Content } from "@/types";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Progress } from "@/components/ui/progress";

interface ContinueWatchingRowProps {
  onPlay: (content: Content, progress: number) => void;
  onDetails: (content: Content) => void;
}

interface WatchHistoryItem {
  id: string;
  content_id: string;
  progress: number;
  last_watched: string;
  content: {
    id: string;
    title: string;
    description: string;
    thumbnail_url: string;
    video_url: string;
    genre: string;
    content_type: string;
    is_premium: boolean;
    duration: number;
    year: number;
  };
}

export const ContinueWatchingRow = ({ onPlay, onDetails }: ContinueWatchingRowProps) => {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: watchHistory = [] } = useQuery({
    queryKey: ["continue-watching", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("watch_history")
        .select(`
          id,
          content_id,
          progress,
          last_watched,
          content:content_id (
            id,
            title,
            description,
            thumbnail_url,
            video_url,
            genre,
            content_type,
            is_premium,
            duration,
            year
          )
        `)
        .eq("user_id", user.id)
        .gt("progress", 0)
        .order("last_watched", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as WatchHistoryItem[];
    },
    enabled: !!user,
  });

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Filter out completed content (>95% watched) and transform
  const continueWatching = watchHistory
    .filter((item) => {
      if (!item.content) return false;
      const progressPercent = item.content.duration > 0 
        ? (item.progress / item.content.duration) * 100 
        : 0;
      return progressPercent < 95 && progressPercent > 1;
    })
    .map((item) => ({
      ...item,
      progressPercent: item.content.duration > 0 
        ? Math.min(Math.round((item.progress / item.content.duration) * 100), 100)
        : 0,
      content: {
        id: item.content.id,
        title: item.content.title,
        description: item.content.description || "",
        thumbnailUrl: item.content.thumbnail_url || "",
        videoUrl: item.content.video_url || "",
        genre: item.content.genre || "",
        contentType: item.content.content_type as "movie" | "series",
        isPremium: item.content.is_premium || false,
        duration: item.content.duration || 0,
        year: item.content.year,
      } as Content,
    }));

  if (continueWatching.length === 0) return null;

  const formatTimeRemaining = (progress: number, duration: number) => {
    const remaining = duration - progress;
    const minutes = Math.floor(remaining / 60);
    if (minutes < 60) return `${minutes}m remaining`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m remaining`;
  };

  return (
    <section className="mb-8">
      <h2 className="font-display text-xl md:text-2xl mb-4 px-4 md:px-12">
        Continue Watching
      </h2>
      
      <div className="relative group/row">
        {/* Scroll Buttons */}
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-8 z-10 w-12 bg-gradient-to-r from-background to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
        
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-8 z-10 w-12 bg-gradient-to-l from-background to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-8 w-8" />
        </button>

        {/* Content Scroll */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {continueWatching.map((item) => (
            <div
              key={item.id}
              className="group relative flex-shrink-0 cursor-pointer w-72 md:w-80"
            >
              {/* Thumbnail with 16:9 aspect ratio */}
              <div 
                className="relative rounded-lg overflow-hidden bg-secondary aspect-video"
                onClick={() => onDetails(item.content)}
              >
                <img
                  src={item.content.thumbnailUrl}
                  alt={item.content.title}
                  className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
                  loading="lazy"
                />
                
                {/* Premium Badge */}
                {item.content.isPremium && (
                  <div className="absolute top-2 left-2 bg-brand px-2 py-0.5 rounded text-xs font-semibold text-primary-foreground">
                    PREMIUM
                  </div>
                )}

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(item.content, item.progress);
                    }}
                    className="w-14 h-14 rounded-full bg-brand flex items-center justify-center hover:bg-brand/90 transition-colors shadow-lg"
                  >
                    <Play className="h-7 w-7 ml-1 text-primary-foreground" fill="currentColor" />
                  </button>
                </div>

                {/* Progress Bar at Bottom */}
                <div className="absolute bottom-0 left-0 right-0">
                  <Progress 
                    value={item.progressPercent} 
                    className="h-1 rounded-none bg-muted/50"
                  />
                </div>
              </div>

              {/* Title & Progress Info */}
              <div className="mt-2 px-1">
                <h3 className="font-medium text-sm truncate">{item.content.title}</h3>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <span>{formatTimeRemaining(item.progress, item.content.duration)}</span>
                  <span>{item.progressPercent}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
