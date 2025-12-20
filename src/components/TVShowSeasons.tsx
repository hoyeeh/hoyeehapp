import { useState, useMemo } from "react";
import { useSeasons, useEpisodes, Season, Episode } from "@/hooks/useSeasons";
import { useEpisodeWatchProgress, formatProgress, getProgressPercent } from "@/hooks/useEpisodeWatchProgress";
import { Content } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DownloadButton } from "./DownloadButton";
import { SeasonDownloadButton } from "./SeasonDownloadButton";
import { Play, Clock, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TVShowSeasonsProps {
  content: Content;
  onPlayEpisode: (episode: Episode, resumeAt?: number) => void;
}

const EpisodeList = ({ 
  content, 
  seasonId, 
  seasonNumber,
  onPlayEpisode 
}: { 
  content: Content; 
  seasonId: string;
  seasonNumber: number;
  onPlayEpisode: (episode: Episode, resumeAt?: number) => void;
}) => {
  const { data: episodes = [], isLoading } = useEpisodes(seasonId);
  
  // Get all episode IDs for fetching progress
  const episodeIds = useMemo(() => episodes.map(ep => ep.id), [episodes]);
  const { data: progressMap = {} } = useEpisodeWatchProgress(episodeIds);

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading episodes...</div>;
  }

  if (episodes.length === 0) {
    return <div className="p-4 text-muted-foreground">No episodes available</div>;
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  return (
    <div className="space-y-2">
      {/* Season Download Button */}
      <div className="px-4 pb-2">
        <SeasonDownloadButton
          content={content}
          seasonId={seasonId}
          seasonNumber={seasonNumber}
          episodes={episodes}
        />
      </div>

      {/* Episode List */}
      {episodes.map((episode) => {
        const episodeProgress = progressMap[episode.id];
        const progressPercent = episodeProgress 
          ? getProgressPercent(episodeProgress.progress, episode.duration) 
          : 0;
        const hasProgress = progressPercent > 0 && progressPercent < 95;
        const isWatched = progressPercent >= 95;

        return (
          <div
            key={episode.id}
            className="flex gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
          >
            {/* Thumbnail with progress bar */}
            <div className="relative flex-shrink-0 w-32 aspect-video rounded overflow-hidden bg-secondary">
              {episode.thumbnail_url ? (
                <img
                  src={episode.thumbnail_url}
                  alt={episode.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  No Image
                </div>
              )}
              
              {/* Progress bar overlay */}
              {progressPercent > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                  <div 
                    className={cn(
                      "h-full transition-all",
                      isWatched ? "bg-muted-foreground" : "bg-primary"
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
              
              {/* Watched indicator */}
              {isWatched && (
                <div className="absolute top-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                  Watched
                </div>
              )}
              
              <button
                onClick={() => onPlayEpisode(episode)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
              >
                <Play className="h-8 w-8 text-white" fill="white" />
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-medium">
                    {episode.episode_number}. {episode.title}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(episode.duration)}
                    </span>
                    {episode.is_premium && (
                      <span className="text-brand text-xs font-medium">PREMIUM</span>
                    )}
                    {episode.video_url ? (
                      <Badge variant="secondary" className="h-5 px-2 text-[10px]">Available</Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 px-2 text-[10px]">Coming soon</Badge>
                    )}
                  </div>
                  
                  {/* Resume button with progress info */}
                  {hasProgress && episode.video_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPlayEpisode(episode, episodeProgress.progress)}
                      className="mt-2 h-7 text-xs gap-1.5"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Resume at {formatProgress(episodeProgress.progress)}
                    </Button>
                  )}
                </div>
                <DownloadButton
                  content={content}
                  episodeId={episode.id}
                  episodeTitle={`S${seasonNumber}E${episode.episode_number} - ${episode.title}`}
                  variant="icon"
                />
              </div>
              {episode.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {episode.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const TVShowSeasons = ({ content, onPlayEpisode }: TVShowSeasonsProps) => {
  const { data: seasons = [], isLoading } = useSeasons(content.id);
  const [expandedSeason, setExpandedSeason] = useState<string | null>(
    seasons.length > 0 ? seasons[0]?.id : null
  );

  // Auto-expand first season when loaded
  if (seasons.length > 0 && !expandedSeason) {
    setExpandedSeason(seasons[0].id);
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading seasons...
      </div>
    );
  }

  if (seasons.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">Episodes</h2>
      
      <div className="space-y-2">
        {seasons.map((season) => (
          <div
            key={season.id}
            className="border border-border rounded-lg overflow-hidden"
          >
            {/* Season Header */}
            <button
              onClick={() => setExpandedSeason(expandedSeason === season.id ? null : season.id)}
              className="w-full flex items-center justify-between p-4 bg-card hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">
                  Season {season.season_number}
                </span>
                {season.title && (
                  <span className="text-muted-foreground">
                    {season.title}
                  </span>
                )}
                {season.year && (
                  <span className="text-sm text-muted-foreground">
                    ({season.year})
                  </span>
                )}
              </div>
              {expandedSeason === season.id ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {/* Episodes */}
            {expandedSeason === season.id && (
              <div className="border-t border-border bg-background/50">
                <EpisodeList
                  content={content}
                  seasonId={season.id}
                  seasonNumber={season.season_number}
                  onPlayEpisode={onPlayEpisode}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
