import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Content } from "@/types";
import { Play, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

interface MobileContinueWatchingProps {
  onPlay: (content: Content, progress: number, episodeId?: string) => void;
  onDetails: (content: Content) => void;
}

interface ContinueWatchingItem {
  id: string;
  contentId: string;
  episodeId?: string;
  title: string;
  subtitle?: string;
  thumbnailUrl: string;
  progress: number;
  duration: number;
  progressPercent: number;
  isPremium: boolean;
  isEpisode: boolean;
  content: Content;
}

export function MobileContinueWatching({ onPlay, onDetails }: MobileContinueWatchingProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: continueWatching = [] } = useQuery({
    queryKey: ["mobile-continue-watching-enhanced", user?.id],
    queryFn: async (): Promise<ContinueWatchingItem[]> => {
      if (!user) return [];
      
      // Fetch all watch history
      const { data: watchHistory, error } = await supabase
        .from("watch_history")
        .select("id, content_id, progress, last_watched")
        .eq("user_id", user.id)
        .gt("progress", 0)
        .order("last_watched", { ascending: false })
        .limit(30);

      if (error) throw error;
      if (!watchHistory?.length) return [];

      const contentIds = watchHistory.map(w => w.content_id);

      // Fetch movie content
      const { data: movies } = await supabase
        .from("content")
        .select("id, title, thumbnail_url, video_url, content_type, is_premium, duration")
        .in("id", contentIds)
        .eq("content_type", "movie");

      // Fetch episode content
      const { data: episodes } = await supabase
        .from("episodes")
        .select(`
          id,
          title,
          thumbnail_url,
          episode_number,
          duration,
          video_url,
          season:season_id (
            season_number,
            content:content_id (
              id,
              title,
              thumbnail_url,
              content_type,
              is_premium
            )
          )
        `)
        .in("id", contentIds);

      const items: ContinueWatchingItem[] = [];

      watchHistory.forEach((w) => {
        const movie = movies?.find(m => m.id === w.content_id);
        const episode = episodes?.find(e => e.id === w.content_id);

        if (movie) {
          const duration = movie.duration || 0;
          const progressPercent = duration > 0 ? Math.min(Math.round((w.progress / duration) * 100), 100) : 0;
          
          if (progressPercent >= 1 && progressPercent < 95) {
            items.push({
              id: w.id,
              contentId: movie.id,
              title: movie.title,
              thumbnailUrl: movie.thumbnail_url || "",
              progress: w.progress,
              duration,
              progressPercent,
              isPremium: movie.is_premium || false,
              isEpisode: false,
              content: {
                id: movie.id,
                title: movie.title,
                description: "",
                thumbnailUrl: movie.thumbnail_url || "",
                videoUrl: movie.video_url || "",
                genre: "",
                contentType: "movie",
                isPremium: movie.is_premium || false,
                duration: movie.duration || 0,
              },
            });
          }
        } else if (episode && episode.season?.content) {
          const duration = episode.duration || 0;
          const progressPercent = duration > 0 ? Math.min(Math.round((w.progress / duration) * 100), 100) : 0;
          
          if (progressPercent >= 1 && progressPercent < 95) {
            items.push({
              id: w.id,
              contentId: episode.season.content.id,
              episodeId: episode.id,
              title: episode.season.content.title,
              subtitle: `S${episode.season.season_number} E${episode.episode_number}`,
              thumbnailUrl: episode.thumbnail_url || episode.season.content.thumbnail_url || "",
              progress: w.progress,
              duration,
              progressPercent,
              isPremium: episode.season.content.is_premium || false,
              isEpisode: true,
              content: {
                id: episode.season.content.id,
                title: episode.season.content.title,
                description: "",
                thumbnailUrl: episode.season.content.thumbnail_url || "",
                videoUrl: episode.video_url || "",
                genre: "",
                contentType: "series",
                isPremium: episode.season.content.is_premium || false,
                duration: episode.duration || 0,
              },
            });
          }
        }
      });

      return items.slice(0, 20);
    },
    enabled: !!user,
  });

  if (continueWatching.length === 0) return null;

  const formatTimeRemaining = (progress: number, duration: number) => {
    const remaining = Math.max(0, duration - progress);
    const minutes = Math.floor(remaining / 60);
    if (minutes < 60) return `${minutes}m left`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m left`;
  };

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-lg font-semibold">Continue Watching</h2>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>
      
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {continueWatching.map((item) => (
          <div
            key={item.id}
            className="flex-shrink-0 w-64 active:scale-95 transition-transform"
          >
            {/* Thumbnail */}
            <div 
              className="relative rounded-lg overflow-hidden bg-secondary aspect-video"
              onClick={() => onDetails(item.content)}
            >
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              

              {/* Episode Badge */}
              {item.isEpisode && item.subtitle && (
                <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium">
                  {item.subtitle}
                </div>
              )}

              {/* Play Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay(item.content, item.progress, item.episodeId);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/20"
              >
                <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
                  <Play className="h-6 w-6 ml-0.5 text-primary-foreground" fill="currentColor" />
                </div>
              </button>

              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0">
                <Progress 
                  value={item.progressPercent} 
                  className="h-1 rounded-none bg-muted/50"
                />
              </div>
            </div>

            {/* Title & Info */}
            <div className="mt-2">
              <h3 className="font-medium text-sm truncate">{item.title}</h3>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                <span>{formatTimeRemaining(item.progress, item.duration)}</span>
                <span>{item.progressPercent}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
