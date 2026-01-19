import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Content } from "@/types";
import { ChevronLeft, ChevronRight, Clock, Play, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface RecentlyWatchedRowProps {
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

export function RecentlyWatchedRow({ onPlay, onDetails }: RecentlyWatchedRowProps) {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: recentlyWatched = [] } = useQuery({
    queryKey: ["recently-watched-completed", user?.id],
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

      return items.slice(0, 20);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const formatLastWatched = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${diffDays >= 14 ? "s" : ""} ago`;
    return `${Math.floor(diffDays / 30)} month${diffDays >= 60 ? "s" : ""} ago`;
  };

  if (recentlyWatched.length === 0) return null;

  return (
    <section className="px-4 md:px-12 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-xl md:text-2xl">Recently Watched</h2>
        </div>
        <div className="hidden md:flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => scroll("left")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => scroll("right")}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {recentlyWatched.map((item) => (
          <div
            key={item.id}
            className="flex-shrink-0 w-48 md:w-56 group cursor-pointer"
          >
            <div
              className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary shadow-lg ring-0 group-hover:ring-2 ring-brand/50 transition-all"
              onClick={() => onDetails(item.content)}
            >
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Watched Badge */}
              <div className="absolute top-2 left-2 bg-green-500/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                <RotateCcw className="h-3 w-3" />
                <span className="text-[10px] font-semibold text-white">WATCHED</span>
              </div>

              {/* Episode Badge */}
              {item.isEpisode && item.subtitle && (
                <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                  {item.subtitle}
                </div>
              )}

              {/* Premium badge hidden per user request */}

              {/* Hover Play Button */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  size="lg"
                  className="rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(item.content);
                  }}
                >
                  <Play className="h-5 w-5 mr-1" fill="currentColor" />
                  Watch Again
                </Button>
              </div>
            </div>

            <div className="mt-2">
              <h3 className="font-medium text-sm truncate">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatLastWatched(item.lastWatched)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
