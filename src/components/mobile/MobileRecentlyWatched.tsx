import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Content } from "@/types";
import { Clock, Play, RotateCcw, ChevronRight } from "lucide-react";
import { useRef } from "react";

interface MobileRecentlyWatchedProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

interface RecentlyWatchedItem {
  id: string;
  contentId: string;
  episodeId?: string;
  title: string;
  subtitle?: string;
  thumbnailUrl: string;
  lastWatched: string;
  isPremium: boolean;
  isEpisode: boolean;
  content: Content;
}

export function MobileRecentlyWatched({ onPlay, onDetails }: MobileRecentlyWatchedProps) {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: recentlyWatched = [] } = useQuery({
    queryKey: ["mobile-recently-watched-completed", user?.id],
    queryFn: async (): Promise<RecentlyWatchedItem[]> => {
      if (!user) return [];

      // Fetch watch history with progress >= 95% (completed content)
      const { data: watchHistory, error } = await supabase
        .from("watch_history")
        .select("id, content_id, progress, last_watched")
        .eq("user_id", user.id)
        .gt("progress", 0)
        .order("last_watched", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!watchHistory?.length) return [];

      const contentIds = watchHistory.map((w) => w.content_id);

      // Fetch movie content
      const { data: movies } = await supabase
        .from("content")
        .select("id, title, thumbnail_url, video_url, content_type, is_premium, duration, genre, year")
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
              is_premium,
              genre,
              year
            )
          )
        `)
        .in("id", contentIds);

      const items: RecentlyWatchedItem[] = [];
      const seenContentIds = new Set<string>();

      watchHistory.forEach((w) => {
        const movie = movies?.find((m) => m.id === w.content_id);
        const episode = episodes?.find((e) => e.id === w.content_id);

        if (movie) {
          const duration = movie.duration || 0;
          const progressPercent =
            duration > 0 ? Math.min(Math.round((w.progress / duration) * 100), 100) : 0;

          // Only show completed content (>= 95% watched)
          if (progressPercent >= 95 && !seenContentIds.has(movie.id)) {
            seenContentIds.add(movie.id);
            items.push({
              id: w.id,
              contentId: movie.id,
              title: movie.title,
              thumbnailUrl: movie.thumbnail_url || "",
              lastWatched: w.last_watched,
              isPremium: movie.is_premium || false,
              isEpisode: false,
              content: {
                id: movie.id,
                title: movie.title,
                description: "",
                thumbnailUrl: movie.thumbnail_url || "",
                videoUrl: movie.video_url || "",
                genre: movie.genre || "",
                contentType: "movie",
                isPremium: movie.is_premium || false,
                duration: movie.duration || 0,
                year: movie.year,
              },
            });
          }
        } else if (episode && episode.season?.content) {
          const duration = episode.duration || 0;
          const progressPercent =
            duration > 0 ? Math.min(Math.round((w.progress / duration) * 100), 100) : 0;

          // Only show completed episodes, dedupe by series
          const seriesId = episode.season.content.id;
          if (progressPercent >= 95 && !seenContentIds.has(seriesId)) {
            seenContentIds.add(seriesId);
            items.push({
              id: w.id,
              contentId: seriesId,
              episodeId: episode.id,
              title: episode.season.content.title,
              subtitle: `S${episode.season.season_number} E${episode.episode_number}`,
              thumbnailUrl: episode.thumbnail_url || episode.season.content.thumbnail_url || "",
              lastWatched: w.last_watched,
              isPremium: episode.season.content.is_premium || false,
              isEpisode: true,
              content: {
                id: seriesId,
                title: episode.season.content.title,
                description: "",
                thumbnailUrl: episode.season.content.thumbnail_url || "",
                videoUrl: episode.video_url || "",
                genre: episode.season.content.genre || "",
                contentType: "series",
                isPremium: episode.season.content.is_premium || false,
                duration: episode.duration || 0,
                year: episode.season.content.year,
              },
            });
          }
        }
      });

      return items.slice(0, 15);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const formatLastWatched = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  if (recentlyWatched.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Recently Watched</h2>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {recentlyWatched.map((item) => (
          <div
            key={item.id}
            className="flex-shrink-0 w-32 active:scale-95 transition-transform"
          >
            {/* Thumbnail */}
            <div
              className="relative rounded-lg overflow-hidden bg-secondary aspect-[2/3]"
              onClick={() => onDetails(item.content)}
            >
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Watched Badge */}
              <div className="absolute top-1.5 left-1.5 bg-green-500/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <RotateCcw className="h-2.5 w-2.5 text-white" />
              </div>

              {/* Episode Badge */}
              {item.isEpisode && item.subtitle && (
                <div className="absolute top-1.5 right-1.5 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-medium">
                  {item.subtitle}
                </div>
              )}

              {/* Play overlay */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay(item.content);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/20"
              >
                <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center opacity-0 active:opacity-100">
                  <Play className="h-5 w-5 ml-0.5 text-primary-foreground" fill="currentColor" />
                </div>
              </button>
            </div>

            {/* Title & Info */}
            <div className="mt-1.5">
              <h3 className="font-medium text-xs truncate">{item.title}</h3>
              <span className="text-[10px] text-muted-foreground">{formatLastWatched(item.lastWatched)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
