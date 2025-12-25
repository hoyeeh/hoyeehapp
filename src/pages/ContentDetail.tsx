import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useContent, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist, useProfile } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoPlayer } from "@/components/VideoPlayer";
import { PreviouslyOnRecap } from "@/components/PreviouslyOnRecap";
import { ContentRatingBadge } from "@/components/ContentRatingBadge";
import { CastQueuePanel } from "@/components/CastQueuePanel";
import { UniversalCastButton } from "@/components/cast/UniversalCastButton";
import { TVShowSeasons } from "@/components/TVShowSeasons";
import { DownloadButton } from "@/components/DownloadButton";
import { MoreLikeThisSection } from "@/components/MoreLikeThisSection";
import { WatchPartyPanel } from "@/components/WatchPartyPanel";
import { SeriesNotificationButton } from "@/components/SeriesNotificationButton";
import { useCastQueue, QueueItem } from "@/hooks/useCastQueue";
import { Episode } from "@/hooks/useSeasons";
import { useEpisodeWatchProgress } from "@/hooks/useEpisodeWatchProgress";
import { useSEO } from "@/hooks/useSEO";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Plus, Check, Star, Clock, Calendar, ListVideo, Filter, User, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { toast } from "sonner";
import { toCdnUrl } from "@/utils/cdnUrl";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { useMobileVideoPlayer } from "@/contexts/MobileVideoPlayerContext";

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
  genre_ids?: number[];
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

// Helper to parse cast_members from database (stored as JSON)
const parseDatabaseCast = (castMembers: any): CastMember[] => {
  if (!castMembers) return [];
  if (Array.isArray(castMembers)) return castMembers;
  try {
    return typeof castMembers === 'string' ? JSON.parse(castMembers) : [];
  } catch {
    return [];
  }
};

// Recommendations Section with Filters
interface RecommendationsSectionProps {
  recommendations: Recommendation[];
  allContent: any[];
  onRecommendationClick: (tmdbId: number) => void;
  onAddToQueue: (rec: Recommendation) => void;
}

// TMDB genre ID mapping
const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

const RecommendationsSection = ({ 
  recommendations, 
  allContent, 
  onRecommendationClick, 
  onAddToQueue 
}: RecommendationsSectionProps) => {
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");

  // Get unique years from recommendations
  const years = useMemo(() => {
    const uniqueYears = [...new Set(recommendations.map(r => r.year).filter(Boolean))];
    return uniqueYears.sort((a, b) => parseInt(b) - parseInt(a));
  }, [recommendations]);

  // Get unique genres from recommendations
  const genres = useMemo(() => {
    const genreIds = new Set<number>();
    recommendations.forEach(r => {
      r.genre_ids?.forEach(id => genreIds.add(id));
    });
    return Array.from(genreIds)
      .map(id => ({ id, name: TMDB_GENRES[id] || `Genre ${id}` }))
      .filter(g => g.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recommendations]);

  // Filter recommendations
  const filteredRecs = useMemo(() => {
    return recommendations.filter(rec => {
      if (yearFilter !== "all" && rec.year !== yearFilter) return false;
      if (ratingFilter !== "all") {
        const rating = parseFloat(rec.rating || "0");
        if (ratingFilter === "high" && rating < 7) return false;
        if (ratingFilter === "medium" && (rating < 5 || rating >= 7)) return false;
        if (ratingFilter === "low" && rating >= 5) return false;
      }
      if (genreFilter !== "all") {
        const genreId = parseInt(genreFilter);
        if (!rec.genre_ids?.includes(genreId)) return false;
      }
      return true;
    });
  }, [recommendations, yearFilter, ratingFilter, genreFilter]);

  const clearFilters = () => {
    setYearFilter("all");
    setRatingFilter("all");
    setGenreFilter("all");
  };

  const hasActiveFilters = yearFilter !== "all" || ratingFilter !== "all" || genreFilter !== "all";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="font-display text-2xl">More Like This</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {genres.length > 0 && (
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {genres.map(genre => (
                  <SelectItem key={genre.id} value={genre.id.toString()}>{genre.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="high">7+ Stars</SelectItem>
              <SelectItem value="medium">5-7 Stars</SelectItem>
              <SelectItem value="low">Under 5</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
              Clear
            </Button>
          )}
        </div>
      </div>
      
      {filteredRecs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No recommendations match your filters.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredRecs.map((rec) => (
            <div key={rec.tmdb_id} className="group relative">
              <div 
                className="cursor-pointer"
                onClick={() => onRecommendationClick(rec.tmdb_id)}
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToQueue(rec);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-brand"
                title="Add to Cast Queue"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ContentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const episodeIdFromUrl = searchParams.get('episode') || searchParams.get('episodeId');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: allContent = [] } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const { data: profile } = useProfile();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  
  // Mobile device detection and video player
  const { isMobileDevice, isTablet } = useMobileDevice();
  const mobilePlayer = useMobileVideoPlayer();
  const isMobile = isMobileDevice || isTablet;
  
  // Cast Queue
  const castQueue = useCastQueue();
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [tmdbDetails, setTmdbDetails] = useState<TMDBDetails | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playingEpisode, setPlayingEpisode] = useState<Episode | null>(null);
  const [episodeResumeAt, setEpisodeResumeAt] = useState<number>(0);
  const [episodeAutoPlayAttempted, setEpisodeAutoPlayAttempted] = useState(false);
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [showRecap, setShowRecap] = useState(false);
  const [recapEpisode, setRecapEpisode] = useState<Episode | null>(null);
  const [isLoadingPlay, setIsLoadingPlay] = useState(false);

  // Fetch episode watch progress for resume functionality
  const episodeIds = useMemo(() => allEpisodes.map(ep => ep.id), [allEpisodes]);
  const { data: episodeProgress = {} } = useEpisodeWatchProgress(episodeIds);

  const content = allContent.find(c => c.id === id);
  const isInList = id ? watchlistIds.includes(id) : false;
  const isTVShow = content?.contentType === 'series';

  // SEO meta tags for content
  const castNames = useMemo(() => {
    if (tmdbDetails?.cast) {
      return tmdbDetails.cast.slice(0, 5).map(c => c.name);
    }
    const dbCast = parseDatabaseCast((content as any)?.cast_members);
    return dbCast.slice(0, 5).map(c => c.name);
  }, [tmdbDetails, content]);

  useSEO({
    title: content?.title || tmdbDetails?.title,
    description: content?.description || tmdbDetails?.description || `Watch ${content?.title || 'this content'} on Hoyeeh - Stream movies and TV shows in HD quality.`,
    image: content?.thumbnailUrl || tmdbDetails?.backdrop_url || undefined,
    url: id ? `https://hoyeeh.com/content/${id}` : undefined,
    type: isTVShow ? 'video.tv_show' : 'video.movie',
    keywords: [
      content?.title || '',
      content?.genre || '',
      isTVShow ? 'TV series' : 'movie',
      'streaming',
      'watch online',
      'Hoyeeh',
      ...(tmdbDetails?.genres || []),
    ].filter(Boolean),
    releaseDate: content?.year ? `${content.year}-01-01` : undefined,
    duration: content?.duration || tmdbDetails?.duration,
    rating: content?.rating || tmdbDetails?.rating,
    director: (content as any)?.director || tmdbDetails?.director || undefined,
    actors: castNames,
    genre: content?.genre || tmdbDetails?.genres?.join(', '),
  });

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

  // Auto-play episode from URL parameter
  useEffect(() => {
    const fetchAndPlayEpisode = async () => {
      if (!episodeIdFromUrl || episodeAutoPlayAttempted || !content) return;

      setEpisodeAutoPlayAttempted(true);

      try {
        const { data: episode, error } = await supabase
          .from('episodes')
          .select('*')
          .eq('id', episodeIdFromUrl)
          .maybeSingle();

        if (error) {
          toast.error("Failed to load episode");
          return;
        }

        if (!episode) {
          toast.error("Episode not found");
          return;
        }

        if (!episode.video_url) {
          toast.error("This episode is not yet available");
          return;
        }

        if (episode.is_premium && !profile?.is_subscribed) {
          toast.error("This episode requires a premium subscription");
          navigate("/subscription");
          return;
        }

        // Use mobile player on mobile devices
        if (isMobile && content) {
          // Wait for all episodes to be loaded
          if (allEpisodes.length > 0) {
            const epData = episode as any;
            const currentIndex = allEpisodes.findIndex(ep => ep.id === episode.id);
            let nextEp: Episode | null = null;
            for (let i = currentIndex + 1; i < allEpisodes.length; i++) {
              if (allEpisodes[i].video_url) {
                nextEp = allEpisodes[i];
                break;
              }
            }

            mobilePlayer.openPlayer({
              content,
              videoUrl: episode.video_url,
              title: content.title,
              episodeTitle: `E${episode.episode_number} - ${episode.title}`,
              episodeId: episode.id,
              resumeAt: 0,
              introStartTime: epData.intro_start_time ?? undefined,
              introEndTime: epData.intro_end_time ?? undefined,
              recapStartTime: epData.recap_start_time ?? undefined,
              recapEndTime: epData.recap_end_time ?? undefined,
              thumbnail: episode.thumbnail_url || content.thumbnailUrl,
              hasNextEpisode: !!nextEp,
              nextEpisode: nextEp,
              allEpisodes,
            });
          }
          return;
        }

        setPlayingEpisode(episode as Episode);
      } catch (e) {
        console.error('Failed to fetch episode:', e);
        toast.error("Failed to load episode");
      }
    };

    fetchAndPlayEpisode();
  }, [episodeIdFromUrl, episodeAutoPlayAttempted, content, profile, navigate, isMobile, allEpisodes, mobilePlayer]);

  // Fetch all episodes for next episode functionality
  useEffect(() => {
    const fetchAllEpisodes = async () => {
      if (!content || content.contentType !== 'series') return;

      const { data: seasons } = await supabase
        .from('seasons')
        .select('id, season_number')
        .eq('content_id', content.id)
        .order('season_number');

      if (!seasons?.length) return;

      const episodesPromises = seasons.map(async (season) => {
        const { data: eps } = await supabase
          .from('episodes')
          .select('*')
          .eq('season_id', season.id)
          .order('episode_number');
        return (eps || []).map(ep => ({ ...ep, season_number: season.season_number }));
      });

      const allEps = (await Promise.all(episodesPromises)).flat();
      setAllEpisodes(allEps as Episode[]);
    };

    fetchAllEpisodes();
  }, [content]);

  // Find next episode
  const getNextEpisode = useMemo(() => {
    if (!playingEpisode || allEpisodes.length === 0) return null;
    
    const currentIndex = allEpisodes.findIndex(ep => ep.id === playingEpisode.id);
    if (currentIndex === -1 || currentIndex >= allEpisodes.length - 1) return null;
    
    // Find next episode with a video URL
    for (let i = currentIndex + 1; i < allEpisodes.length; i++) {
      if (allEpisodes[i].video_url) {
        return allEpisodes[i];
      }
    }
    return null;
  }, [playingEpisode, allEpisodes]);

  const handlePlayNextEpisode = (nextEp: { id: string; title: string; episodeNumber: number; videoUrl: string }) => {
    const episode = allEpisodes.find(ep => ep.id === nextEp.id);
    if (episode) {
      setEpisodeResumeAt(0);
      setPlayingEpisode(episode);
      toast.success(`Now playing: E${episode.episode_number} - ${episode.title}`);
    }
  };

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

  const handlePlay = async () => {
    if (content?.isPremium && !profile?.is_subscribed) {
      toast.error("This content requires a premium subscription");
      navigate("/subscription");
      return;
    }

    // For TV series, find the best episode to play (last watched or first available)
    if (isTVShow) {
      setIsLoadingPlay(true);
      try {
        if (allEpisodes.length === 0) {
          toast.error("No episodes available yet");
          return;
        }

        // Find the last watched episode with progress, or the first episode with video
        let episodeToPlay: Episode | undefined;
        let resumeProgress = 0;

        // Check for episode with existing progress (continue watching)
        const episodesWithProgress = allEpisodes
          .filter(ep => ep.video_url && episodeProgress[ep.id])
          .map(ep => ({
            episode: ep,
            progress: episodeProgress[ep.id],
          }))
          .sort((a, b) => new Date(b.progress.lastWatched).getTime() - new Date(a.progress.lastWatched).getTime());

        if (episodesWithProgress.length > 0) {
          const lastWatched = episodesWithProgress[0];
          // Check if not completed (< 90% watched)
          const duration = (lastWatched.episode as any).duration || 0;
          const progressPercent = duration > 0 ? (lastWatched.progress.progress / duration) * 100 : 0;
          
          if (progressPercent < 90) {
            episodeToPlay = lastWatched.episode;
            resumeProgress = lastWatched.progress.progress;
          } else {
            // Find the next unwatched episode
            const currentIndex = allEpisodes.findIndex(ep => ep.id === lastWatched.episode.id);
            const nextEpisode = allEpisodes.slice(currentIndex + 1).find(ep => ep.video_url);
            episodeToPlay = nextEpisode || allEpisodes.find(ep => ep.video_url);
          }
        } else {
          // No progress, start with first available episode
          episodeToPlay = allEpisodes.find(ep => ep.video_url);
        }

        if (!episodeToPlay) {
          toast.error("No playable episodes available");
          return;
        }

        handlePlayEpisode(episodeToPlay, resumeProgress);
      } finally {
        setIsLoadingPlay(false);
      }
      return;
    }

    // For movies, check video URL
    if (!content?.videoUrl) {
      toast.error("This video is not yet available");
      return;
    }

    // Use mobile player on mobile devices for movies
    if (isMobile && content) {
      mobilePlayer.openPlayer({
        content,
        videoUrl: content.videoUrl,
        title: content.title,
        thumbnail: content.thumbnailUrl,
      });
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

  const handlePlayEpisode = (episode: Episode, resumeAt?: number) => {
    if (!episode.video_url) {
      toast.error("This episode is not yet available");
      return;
    }
    if (episode.is_premium && !profile?.is_subscribed) {
      toast.error("This episode requires a premium subscription");
      navigate("/subscription");
      return;
    }

    // Find next episode for player
    const currentIndex = allEpisodes.findIndex(ep => ep.id === episode.id);
    let nextEp: Episode | null = null;
    for (let i = currentIndex + 1; i < allEpisodes.length; i++) {
      if (allEpisodes[i].video_url) {
        nextEp = allEpisodes[i];
        break;
      }
    }

    const epData = episode as any;

    // Use mobile player on mobile devices
    if (isMobile && content) {
      mobilePlayer.openPlayer({
        content,
        videoUrl: episode.video_url,
        title: content.title,
        episodeTitle: `E${episode.episode_number} - ${episode.title}`,
        episodeId: episode.id,
        resumeAt: resumeAt || 0,
        introStartTime: epData.intro_start_time ?? undefined,
        introEndTime: epData.intro_end_time ?? undefined,
        recapStartTime: epData.recap_start_time ?? undefined,
        recapEndTime: epData.recap_end_time ?? undefined,
        thumbnail: episode.thumbnail_url || content.thumbnailUrl,
        hasNextEpisode: !!nextEp,
        nextEpisode: nextEp,
        allEpisodes,
      });
      return;
    }

    setEpisodeResumeAt(resumeAt || 0);

    // Check if this episode has a recap and we're not resuming
    if (!resumeAt && epData.recap_start_time !== null && epData.recap_end_time !== null) {
      // Find the previous episode to get its video URL for recap
      if (currentIndex > 0) {
        const prevEpisode = allEpisodes[currentIndex - 1];
        if (prevEpisode.video_url) {
          setRecapEpisode(prevEpisode);
          setPlayingEpisode(episode);
          setShowRecap(true);
          return;
        }
      }
    }

    setPlayingEpisode(episode);
  };

  // Show recap before episode
  if (showRecap && recapEpisode && playingEpisode && content) {
    const epData = playingEpisode as any;
    return (
      <PreviouslyOnRecap
        videoUrl={recapEpisode.video_url || ''}
        episodeTitle={recapEpisode.title}
        seasonNumber={(recapEpisode as any).season_number || 1}
        episodeNumber={playingEpisode.episode_number}
        recapStartTime={epData.recap_start_time || 0}
        recapEndTime={epData.recap_end_time || 60}
        onSkip={() => {
          setShowRecap(false);
          setRecapEpisode(null);
        }}
        onComplete={() => {
          setShowRecap(false);
          setRecapEpisode(null);
        }}
      />
    );
  }

  // Playing episode - only render VideoPlayer for desktop (mobile uses persistent player)
  if (playingEpisode && content && !isMobile) {
    const nextEpisodeInfo = getNextEpisode ? {
      id: getNextEpisode.id,
      title: getNextEpisode.title,
      episodeNumber: getNextEpisode.episode_number,
      videoUrl: getNextEpisode.video_url || '',
      thumbnailUrl: getNextEpisode.thumbnail_url || undefined,
    } : undefined;

    const epData = playingEpisode as any;

    return (
      <VideoPlayer
        src={playingEpisode.video_url || ''}
        title={`${content.title} - E${playingEpisode.episode_number} ${playingEpisode.title}`}
        contentId={playingEpisode.id}
        initialProgress={episodeResumeAt}
        introStartTime={epData.intro_start_time ?? 0}
        introEndTime={epData.intro_end_time ?? 90}
        recapStartTime={epData.recap_start_time ?? undefined}
        recapEndTime={epData.recap_end_time ?? undefined}
        onBack={() => {
          setPlayingEpisode(null);
          setEpisodeResumeAt(0);
        }}
        nextEpisode={nextEpisodeInfo}
        onPlayNextEpisode={handlePlayNextEpisode}
      />
    );
  }

  // Playing main content (movie or TV show trailer) - only desktop
  if (playing && content && !isMobile) {
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
  // Prefer database cast_members/director, fall back to TMDB
  const databaseCast = parseDatabaseCast((content as any).cast_members);
  const databaseDirector = (content as any).director;
  const cast = databaseCast.length > 0 ? databaseCast : (tmdbDetails?.cast || []);
  const director = databaseDirector || tmdbDetails?.director;
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
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
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
              <Button 
                size="lg" 
                className="gap-2 bg-brand hover:bg-brand/90" 
                onClick={handlePlay}
                disabled={isLoadingPlay}
              >
                {isLoadingPlay ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Play className="h-5 w-5 fill-current" />
                )}
                {isLoadingPlay ? "Loading..." : (isTVShow && Object.keys(episodeProgress).length > 0 ? "Resume" : "Play")}
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
              {/* Download button for movies */}
              {!isTVShow && <DownloadButton content={content} />}
              {/* Series notification button */}
              <SeriesNotificationButton 
                contentId={content.id} 
                contentType={content.contentType} 
              />
              {/* Watch party */}
              <WatchPartyPanel
                contentId={content.id}
                contentTitle={content.title}
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
            {director && (
              <p className="mt-4 text-sm">
                <span className="text-muted-foreground">Director:</span>{" "}
                <span className="font-medium">{director}</span>
              </p>
            )}
          </div>

          {/* TV Show Seasons & Episodes */}
          {isTVShow && (
            <div className="mb-10">
              <TVShowSeasons content={content} onPlayEpisode={handlePlayEpisode} />
            </div>
          )}

          {/* Cast */}
          {cast.length > 0 && (
            <div className="mb-10">
              <h2 className="font-display text-2xl mb-4">Cast</h2>
              <div className="flex flex-wrap gap-2">
                {cast.map((member) => (
                  <Badge
                    key={member.id}
                    variant="secondary"
                    className="cursor-pointer hover:bg-brand hover:text-primary-foreground transition-colors py-2 px-4 text-sm"
                    onClick={() => navigate(`/search?actor=${encodeURIComponent(member.name)}`)}
                  >
                    <div className="flex items-center gap-2">
                      {member.profile_path ? (
                        <img
                          src={member.profile_path}
                          alt={member.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5" />
                      )}
                      <div className="text-left">
                        <span className="font-medium">{member.name}</span>
                        {member.character && (
                          <span className="text-xs opacity-70 ml-1">as {member.character}</span>
                        )}
                      </div>
                    </div>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* TMDB Recommendations */}
          {recommendations.length > 0 && (
            <RecommendationsSection
              recommendations={recommendations}
              allContent={allContent}
              onRecommendationClick={handleRecommendationClick}
              onAddToQueue={handleAddRecommendationToQueue}
            />
          )}

          {/* More Like This - Local content based on genre */}
          <MoreLikeThisSection
            currentContent={{
              id: content.id,
              title: content.title,
              thumbnailUrl: content.thumbnailUrl,
              year: content.year,
              rating: content.rating,
              genre: content.genre,
              contentType: content.contentType
            }}
            allContent={allContent.map(c => ({
              id: c.id,
              title: c.title,
              thumbnailUrl: c.thumbnailUrl,
              year: c.year,
              rating: c.rating,
              genre: c.genre,
              contentType: c.contentType
            }))}
          />
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
