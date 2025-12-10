import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useProfile } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ContentRatingBadge } from "@/components/ContentRatingBadge";
import { CastQueuePanel } from "@/components/CastQueuePanel";
import { UniversalCastButton } from "@/components/cast/UniversalCastButton";
import { useCastQueue, QueueItem } from "@/hooks/useCastQueue";
import { ArrowLeft, Play, Plus, Check, Star, Clock, Calendar, ListVideo } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "sonner";

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface Recommendation {
  tmdb_id: number;
  title: string;
  thumbnail_url: string | null;
  year: string;
  rating: string;
}

interface TMDBDetails {
  tmdb_id: number;
  title: string;
  description: string;
  backdrop_url: string | null;
  year: string;
  rating: string;
  duration: number;
  genres: string[];
  director: string | null;
  cast: CastMember[];
  recommendations: Recommendation[];
  tagline: string;
}

const ContentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: allContent = [] } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const { data: profile } = useProfile();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  
  // Cast Queue
  const castQueue = useCastQueue();
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [tmdbDetails, setTmdbDetails] = useState<TMDBDetails | null>(null);
  const [playing, setPlaying] = useState(false);

  const content = allContent.find(c => c.id === id);
  const isInList = id ? watchlistIds.includes(id) : false;

  useEffect(() => {
    const fetchTMDBDetails = async () => {
      if (!content) {
        setLoading(false);
        return;
      }

      // If content has tmdb_id, fetch additional details
      const tmdbId = (content as any).tmdb_id;
      if (tmdbId) {
        try {
          const { data, error } = await supabase.functions.invoke('tmdb-details', {
            body: { tmdb_id: tmdbId, type: content.contentType === 'series' ? 'series' : 'movie' }
          });

          if (!error && data) {
            setTmdbDetails(data);
          }
        } catch (e) {
          console.error('Failed to fetch TMDB details:', e);
        }
      }
      setLoading(false);
    };

    fetchTMDBDetails();
  }, [content]);

  const handleToggleList = async () => {
    if (!user || !id) {
      toast.error("Please sign in to add to your list");
      return;
    }

    try {
      if (isInList) {
        await removeFromWatchlist.mutateAsync(id);
        toast.success("Removed from My List");
      } else {
        await addToWatchlist.mutateAsync(id);
        toast.success("Added to My List");
      }
    } catch (error) {
      toast.error("Failed to update watchlist");
    }
  };

  const handlePlay = () => {
    if (content?.isPremium && !profile?.is_subscribed) {
      toast.error("This content requires a premium subscription");
      navigate("/subscription");
      return;
    }
    setPlaying(true);
  };

  const handleAddToQueue = () => {
    if (!content) return;
    
    const queueItem: QueueItem = {
      id: content.id,
      url: content.videoUrl,
      title: content.title,
      thumbnail: content.thumbnailUrl,
      duration: content.duration,
    };
    
    castQueue.addToQueue(queueItem);
  };

  const handleRecommendationClick = (tmdbId: number) => {
    // Find content with this TMDB ID
    const rec = allContent.find((c: any) => c.tmdb_id === tmdbId);
    if (rec) {
      navigate(`/content/${rec.id}`);
    }
  };

  const handleAddRecommendationToQueue = (rec: Recommendation) => {
    const matchedContent = allContent.find((c: any) => c.tmdb_id === rec.tmdb_id);
    if (matchedContent) {
      const queueItem: QueueItem = {
        id: matchedContent.id,
        url: matchedContent.videoUrl,
        title: matchedContent.title,
        thumbnail: matchedContent.thumbnailUrl,
        duration: matchedContent.duration,
      };
      castQueue.addToQueue(queueItem);
    } else {
      toast.error("This content is not available in your library");
    }
  };

  if (playing && content) {
    return (
      <VideoPlayer
        src={content.videoUrl}
        title={content.title}
        contentId={content.id}
        initialProgress={0}
        onBack={() => setPlaying(false)}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading content..." />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <p className="text-xl text-muted-foreground mb-4">Content not found</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const backdropUrl = tmdbDetails?.backdrop_url || content.thumbnailUrl;
  const genres = tmdbDetails?.genres || [content.genre];
  const cast = tmdbDetails?.cast || [];
  const recommendations = tmdbDetails?.recommendations || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Banner with Backdrop */}
      <div className="relative h-[70vh] w-full">
        <div className="absolute inset-0">
          <img
            src={backdropUrl}
            alt={content.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />
        </div>

        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 bg-background/50 hover:bg-background/80"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Queue Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsQueueOpen(true)}
          className="absolute top-4 right-4 z-10 bg-background/50 hover:bg-background/80"
        >
          <ListVideo className="h-5 w-5" />
          {castQueue.queue.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {castQueue.queue.length}
            </span>
          )}
        </Button>

        {/* Content Info */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
          <div className="max-w-3xl">
            {tmdbDetails?.tagline && (
              <p className="text-brand font-medium mb-2">{tmdbDetails.tagline}</p>
            )}
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-4">{content.title}</h1>
            
            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
              {content.rating && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <Star className="h-4 w-4 fill-current" />
                  {content.rating}
                </span>
              )}
              {content.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {content.year}
                </span>
              )}
              {content.duration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {content.duration} min
                </span>
              )}
              {content.isPremium && (
                <span className="bg-brand px-2 py-0.5 rounded text-xs font-semibold text-primary-foreground">
                  PREMIUM
                </span>
              )}
              <ContentRatingBadge rating={(content as any).content_rating} size="md" />
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2 mb-6">
              {genres.map((genre, i) => (
                <span key={i} className="px-3 py-1 bg-secondary rounded-full text-sm">
                  {genre}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="gap-2 bg-brand hover:bg-brand/90" onClick={handlePlay}>
                <Play className="h-5 w-5 fill-current" />
                Play
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="gap-2"
                onClick={handleToggleList}
              >
                {isInList ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isInList ? "In My List" : "My List"}
              </Button>
              <UniversalCastButton
                videoUrl={content.videoUrl}
                videoTitle={content.title}
                thumbnail={content.thumbnailUrl}
                duration={content.duration}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Details */}
      <div className="px-8 md:px-12 py-8">
        <div className="max-w-6xl">
          {/* Description */}
          <div className="mb-10">
            <h2 className="font-display text-2xl mb-4">Synopsis</h2>
            <p className="text-muted-foreground leading-relaxed max-w-3xl">
              {content.description || tmdbDetails?.description}
            </p>
            {tmdbDetails?.director && (
              <p className="mt-4 text-sm">
                <span className="text-muted-foreground">Director:</span>{" "}
                <span className="font-medium">{tmdbDetails.director}</span>
              </p>
            )}
          </div>

          {/* Cast */}
          {cast.length > 0 && (
            <div className="mb-10">
              <h2 className="font-display text-2xl mb-4">Cast</h2>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {cast.map((member) => (
                  <div key={member.id} className="flex-shrink-0 w-28 text-center">
                    <div className="w-28 h-28 rounded-full overflow-hidden bg-secondary mb-2 mx-auto">
                      {member.profile_path ? (
                        <img
                          src={member.profile_path}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                          {member.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <p className="font-medium text-sm truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.character}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div>
              <h2 className="font-display text-2xl mb-4">More Like This</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {recommendations.map((rec) => (
                  <div
                    key={rec.tmdb_id}
                    className="group relative"
                  >
                    <div 
                      className="cursor-pointer"
                      onClick={() => handleRecommendationClick(rec.tmdb_id)}
                    >
                      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary">
                        {rec.thumbnail_url ? (
                          <img
                            src={rec.thumbnail_url}
                            alt={rec.title}
                            className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                      </div>
                      <h3 className="mt-2 font-medium text-sm truncate">{rec.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{rec.year}</span>
                        {rec.rating && (
                          <span className="flex items-center gap-0.5 text-yellow-500">
                            <Star className="h-3 w-3 fill-current" />
                            {rec.rating}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Add to queue button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddRecommendationToQueue(rec);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand"
                      title="Add to Cast Queue"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cast Queue Panel */}
      <CastQueuePanel
        queue={castQueue.queue}
        currentIndex={castQueue.currentIndex}
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        onPlayAtIndex={castQueue.playAtIndex}
        onRemove={castQueue.removeFromQueue}
        onClear={castQueue.clearQueue}
        onReorder={castQueue.reorderQueue}
      />
    </div>
  );
};

export default ContentDetail;
