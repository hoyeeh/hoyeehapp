import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Content } from "@/types";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Progress } from "@/components/ui/progress";

interface ContinueWatchingRowProps {
  onPlay: (content: Content, progress: number, episodeId?: string) => void;
  onDetails: (content: Content) => void;
  maxItems?: number;
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
  } | null;
  episode?: {
    id: string;
    title: string;
    thumbnail_url: string;
    episode_number: number;
    duration: number;
    video_url: string;
    season: {
      season_number: number;
      content: {
        id: string;
        title: string;
        thumbnail_url: string;
        content_type: string;
        is_premium: boolean;
      };
    };
  } | null;
}

export const ContinueWatchingRow = ({ onPlay, onDetails, maxItems = 10 }: ContinueWatchingRowProps) => {
  const { user } = useAuth();
  const { currentProfile } = useProfileContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch watch history for both movies and episodes - filtered by profile
  const { data: watchHistory = [] } = useQuery({
    queryKey: ["continue-watching-enhanced", user?.id, currentProfile?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Build base query for movies
      let movieQuery = supabase
        .from("watch_history")
        .select(`
          id,
          content_id,
          progress,
          last_watched,
          profile_id,
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
        .limit(30);
      
      // Filter by profile if one is selected
      if (currentProfile?.id) {
        movieQuery = movieQuery.eq("profile_id", currentProfile.id);
      }

      const { data: movieHistory, error: movieError } = await movieQuery;

      if (movieError) throw movieError;

      // Filter for movies only and valid content
      const validMovieHistory = (movieHistory || []).filter((item: any) => {
        return item.content && item.content.content_type === 'movie';
      });

      // Now fetch episode watch history - also filtered by profile
      let episodeQuery = supabase
        .from("watch_history")
        .select("id, content_id, progress, last_watched, profile_id")
        .eq("user_id", user.id)
        .gt("progress", 0)
        .order("last_watched", { ascending: false })
        .limit(50);
      
      if (currentProfile?.id) {
        episodeQuery = episodeQuery.eq("profile_id", currentProfile.id);
      }

      const { data: episodeHistory, error: episodeError } = await episodeQuery;

      if (episodeError) throw episodeError;

      // Get all content_ids that might be episodes
      const potentialEpisodeIds = (episodeHistory || [])
        .filter((item: any) => !validMovieHistory.some((m: any) => m.content_id === item.content_id))
        .map((item: any) => item.content_id);

      // Fetch episode details for these IDs
      let episodeDetails: any[] = [];
      if (potentialEpisodeIds.length > 0) {
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
          .in("id", potentialEpisodeIds);

        episodeDetails = episodes || [];
      }

      // Combine and transform the data
      const combinedHistory: WatchHistoryItem[] = [];

      // Add movie history
      validMovieHistory.forEach((item: any) => {
        combinedHistory.push({
          id: item.id,
          content_id: item.content_id,
          progress: item.progress,
          last_watched: item.last_watched,
          content: item.content,
          episode: null,
        });
      });

      // Add episode history
      episodeHistory?.forEach((item: any) => {
        const episodeDetail = episodeDetails.find((e: any) => e.id === item.content_id);
        if (episodeDetail && episodeDetail.season?.content) {
          combinedHistory.push({
            id: item.id,
            content_id: item.content_id,
            progress: item.progress,
            last_watched: item.last_watched,
            content: null,
            episode: episodeDetail,
          });
        }
      });

      // Sort by last_watched
      combinedHistory.sort((a, b) => 
        new Date(b.last_watched).getTime() - new Date(a.last_watched).getTime()
      );

      // Limit to maxItems for display
      return combinedHistory.slice(0, maxItems);
    },
    enabled: !!user && !!currentProfile,
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

  // Filter out completed content (>95% watched) and show content watched for at least 60 seconds
  const continueWatching = watchHistory
    .filter((item) => {
      const duration = item.content?.duration || item.episode?.duration || 0;
      if (duration === 0) return false;
      const progressPercent = (item.progress / duration) * 100;
      // Must have watched at least 60 seconds and less than 95% complete
      return item.progress >= 60 && progressPercent < 95;
    })
    .map((item) => {
      const isEpisode = !!item.episode;
      const duration = item.content?.duration || item.episode?.duration || 0;
      const thumbnailUrl = item.episode?.thumbnail_url || item.episode?.season?.content?.thumbnail_url || item.content?.thumbnail_url || "";
      
      let title = "";
      let subtitle = "";
      
      if (isEpisode && item.episode) {
        title = item.episode.season.content.title;
        subtitle = `S${item.episode.season.season_number} E${item.episode.episode_number} - ${item.episode.title}`;
      } else if (item.content) {
        title = item.content.title;
      }

      const transformedContent: Content = isEpisode && item.episode ? {
        id: item.episode.season.content.id,
        title: item.episode.season.content.title,
        description: "",
        thumbnailUrl: item.episode.season.content.thumbnail_url || "",
        videoUrl: item.episode.video_url || "",
        genre: "",
        contentType: "series",
        isPremium: item.episode.season.content.is_premium || false,
        duration: item.episode.duration || 0,
      } : {
        id: item.content!.id,
        title: item.content!.title,
        description: item.content!.description || "",
        thumbnailUrl: item.content!.thumbnail_url || "",
        videoUrl: item.content!.video_url || "",
        genre: item.content!.genre || "",
        contentType: item.content!.content_type as "movie" | "series",
        isPremium: item.content!.is_premium || false,
        duration: item.content!.duration || 0,
        year: item.content!.year,
      };

      return {
        ...item,
        isEpisode,
        title,
        subtitle,
        thumbnailUrl,
        progressPercent: duration > 0 
          ? Math.min(Math.round((item.progress / duration) * 100), 100)
          : 0,
        duration,
        content: transformedContent,
        episodeId: item.episode?.id,
      };
    });

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
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
                  loading="lazy"
                />
                

                {/* Episode Badge */}
                {item.isEpisode && (
                  <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-medium">
                    {item.subtitle?.split(' - ')[0]}
                  </div>
                )}

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(item.content, item.progress, item.episodeId);
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
                <h3 className="font-medium text-sm truncate">{item.title}</h3>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <span>{formatTimeRemaining(item.progress, item.duration)}</span>
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
