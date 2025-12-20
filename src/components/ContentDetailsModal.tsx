import { useState } from "react";
import { Content } from "@/types";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Play, Plus, Check, Clock, User, PlayCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton } from "./DownloadButton";
import { ContentReviews } from "./ContentReviews";
import { SocialShare } from "./SocialShare";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContentRatingBadge } from "./ContentRatingBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface Episode {
  id: string;
  title: string;
  episode_number: number;
  thumbnail_url: string | null;
  video_url: string | null;
  duration: number | null;
  description: string | null;
}

interface ContentDetailsModalProps {
  content: Content;
  onClose: () => void;
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  isInList: boolean;
  onPlayEpisode?: (content: Content, episodeVideoUrl: string, episodeTitle: string) => void;
}

// Helper to parse cast_members from database
const parseCast = (castMembers: any): CastMember[] => {
  if (!castMembers) return [];
  if (Array.isArray(castMembers)) return castMembers;
  try {
    return typeof castMembers === 'string' ? JSON.parse(castMembers) : [];
  } catch {
    return [];
  }
};

export const ContentDetailsModal = ({
  content,
  onClose,
  onPlay,
  onToggleList,
  isInList,
  onPlayEpisode,
}: ContentDetailsModalProps) => {
  const navigate = useNavigate();
  const [playingFirstEpisode, setPlayingFirstEpisode] = useState(false);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const cast = parseCast((content as any).cast_members);
  const director = (content as any).director;

  // Fetch episodes for TV series
  const { data: episodes = [], isLoading: episodesLoading } = useQuery({
    queryKey: ["modal-episodes", content.id],
    queryFn: async () => {
      // Get first season
      const { data: seasons } = await supabase
        .from("seasons")
        .select("id")
        .eq("content_id", content.id)
        .order("season_number")
        .limit(1);
      
      if (!seasons?.length) return [];

      // Get episodes from first season
      const { data: eps } = await supabase
        .from("episodes")
        .select("id, title, episode_number, thumbnail_url, video_url, duration, description")
        .eq("season_id", seasons[0].id)
        .order("episode_number")
        .limit(6);
      
      return (eps || []) as Episode[];
    },
    enabled: content.contentType === "series",
  });

  const handleActorClick = (actorName: string) => {
    onClose();
    navigate(`/search?actor=${encodeURIComponent(actorName)}`);
  };

  const handlePlayFirstEpisode = async () => {
    if (episodes.length === 0) {
      toast.error("No episodes available yet");
      return;
    }
    
    const firstWithVideo = episodes.find(ep => ep.video_url);
    if (!firstWithVideo) {
      toast.error("No playable episodes available");
      navigate(`/content/${content.id}`);
      onClose();
      return;
    }

    setPlayingFirstEpisode(true);
    if (onPlayEpisode) {
      onPlayEpisode(content, firstWithVideo.video_url!, `S1E${firstWithVideo.episode_number}: ${firstWithVideo.title}`);
    } else {
      navigate(`/content/${content.id}?episode=${firstWithVideo.id}&autoplay=true`);
      onClose();
    }
  };

  const handlePlayEpisode = (episode: Episode) => {
    if (!episode.video_url) {
      toast.error("This episode is not available yet");
      return;
    }
    
    if (onPlayEpisode) {
      onPlayEpisode(content, episode.video_url, `S1E${episode.episode_number}: ${episode.title}`);
    } else {
      navigate(`/content/${content.id}?episode=${episode.id}&autoplay=true`);
      onClose();
    }
  };

  const handleViewAllEpisodes = () => {
    onClose();
    navigate(`/content/${content.id}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl bg-card border border-border animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <ScrollArea className="h-[90vh]">
          {/* Hero Image */}
          <div className="relative h-64 md:h-80">
            <img
              src={content.thumbnailUrl}
              alt={content.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
            
            <div className="absolute top-4 left-4 flex gap-2">
              {content.isPremium && (
                <div className="bg-brand px-3 py-1 rounded text-sm font-semibold text-primary-foreground">
                  PREMIUM
                </div>
              )}
              <ContentRatingBadge rating={content.contentRating} size="md" />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 -mt-16 relative">
            <h2 className="font-display text-3xl md:text-4xl mb-2">{content.title}</h2>
            
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
              {content.year && <span>{content.year}</span>}
              {content.rating && (
                <span className="border border-muted-foreground/30 px-2 py-0.5 rounded">
                  {content.rating}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(content.duration)}
              </span>
              <span className="capitalize">{content.contentType}</span>
              <span className="text-brand">{content.genre}</span>
            </div>

            {/* Director */}
            {director && (
              <p className="text-sm mb-2">
                <span className="text-muted-foreground">Director:</span>{" "}
                <span className="font-medium">{director}</span>
              </p>
            )}

            <p className="text-muted-foreground mb-6 leading-relaxed">
              {content.description}
            </p>

            {/* Episode Preview Section for TV Series */}
            {content.contentType === "series" && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Episodes - Season 1</h3>
                  <button
                    onClick={handleViewAllEpisodes}
                    className="flex items-center gap-1 text-sm text-brand hover:underline"
                  >
                    View All <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                
                {episodesLoading ? (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex-shrink-0 w-48">
                        <Skeleton className="w-full aspect-video rounded-lg" />
                        <Skeleton className="h-4 w-3/4 mt-2" />
                      </div>
                    ))}
                  </div>
                ) : episodes.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {episodes.map((episode) => (
                      <div
                        key={episode.id}
                        className="flex-shrink-0 w-48 cursor-pointer group"
                        onClick={() => handlePlayEpisode(episode)}
                      >
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-secondary">
                          {episode.thumbnail_url ? (
                            <img
                              src={episode.thumbnail_url}
                              alt={episode.title}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-muted to-secondary flex items-center justify-center">
                              <span className="text-2xl font-bold text-muted-foreground">
                                E{episode.episode_number}
                              </span>
                            </div>
                          )}
                          
                          {/* Play Overlay */}
                          <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-foreground/90 flex items-center justify-center">
                              <Play className="h-5 w-5 ml-0.5 text-background" fill="currentColor" />
                            </div>
                          </div>
                          
                          {/* Availability badge */}
                          {!episode.video_url && (
                            <div className="absolute top-2 right-2 bg-background/80 px-2 py-0.5 rounded text-xs">
                              Coming Soon
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-medium mt-2 line-clamp-1">
                          E{episode.episode_number}: {episode.title}
                        </p>
                        {episode.duration && (
                          <p className="text-xs text-muted-foreground">
                            {Math.floor(episode.duration / 60)}m
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No episodes available yet</p>
                )}
              </div>
            )}

            {/* Cast Section with Clickable Chips */}
            {cast.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Cast</h3>
                <div className="flex flex-wrap gap-2">
                  {cast.slice(0, 10).map((member) => (
                    <Badge
                      key={member.id}
                      variant="secondary"
                      className="cursor-pointer hover:bg-brand hover:text-primary-foreground transition-colors py-1.5 px-3"
                      onClick={() => handleActorClick(member.name)}
                    >
                      <div className="flex items-center gap-2">
                        {member.profile_path ? (
                          <img
                            src={member.profile_path}
                            alt={member.name}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                        <span>{member.name}</span>
                      </div>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mb-8">
              {content.contentType === "series" ? (
                <Button
                  variant="brand"
                  size="lg"
                  onClick={handlePlayFirstEpisode}
                  className="gap-2"
                  disabled={playingFirstEpisode || episodesLoading}
                >
                  <PlayCircle className="h-5 w-5" />
                  Play First Episode
                </Button>
              ) : (
                <Button
                  variant="brand"
                  size="lg"
                  onClick={() => {
                    if (!content.videoUrl) {
                      toast.error("Video not available yet");
                      return;
                    }
                    onPlay(content);
                  }}
                  className="gap-2"
                >
                  <Play className="h-5 w-5" fill="currentColor" />
                  Play Now
                </Button>
              )}
              
              <Button
                variant="secondary"
                size="lg"
                onClick={() => onToggleList(content)}
                className="gap-2"
              >
                {isInList ? (
                  <>
                    <Check className="h-5 w-5" />
                    In My List
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    Add to List
                  </>
                )}
              </Button>

              <DownloadButton content={content} variant="button" />
              
              <SocialShare content={content} variant="default" />
            </div>

            {/* Reviews Section */}
            <ContentReviews contentId={content.id} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
