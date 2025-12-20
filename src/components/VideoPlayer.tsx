import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ArrowLeft,
  SkipBack,
  SkipForward,
  Loader2,
  Settings,
  Cast,
  PictureInPicture2,
  ListVideo,
  Tv,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { useWatchProgress } from "@/hooks/useWatchProgress";
import { useGoogleCast } from "@/hooks/useGoogleCast";
import { usePictureInPicture } from "@/hooks/usePictureInPicture";
import { useDLNA } from "@/hooks/useDLNA";
import { CastController } from "@/components/CastController";
import { toast } from "sonner";
import { toCdnUrl } from "@/utils/cdnUrl";

interface NextEpisodeInfo {
  id: string;
  title: string;
  episodeNumber: number;
  videoUrl: string;
  thumbnailUrl?: string;
}

interface VideoPlayerProps {
  src: string;
  title: string;
  contentId: string;
  initialProgress?: number;
  onBack: () => void;
  // Skip intro config (in seconds)
  introStartTime?: number;
  introEndTime?: number;
  // Recap segment (in seconds) - for visual markers only
  recapStartTime?: number;
  recapEndTime?: number;
  // Next episode support
  nextEpisode?: NextEpisodeInfo;
  onPlayNextEpisode?: (episode: NextEpisodeInfo) => void;
}

const QUALITY_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: '1080p', value: '1080' },
  { label: '720p', value: '720' },
  { label: '480p', value: '480' },
];

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const VideoPlayer = ({
  src,
  title,
  contentId,
  initialProgress = 0,
  onBack,
  introStartTime = 0,
  introEndTime = 90, // Default 90 seconds for intro
  recapStartTime,
  recapEndTime,
  nextEpisode,
  onPlayNextEpisode,
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const lastSaveTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(true); // Start as true since video has autoPlay
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [isHls, setIsHls] = useState(false);
  const [loadedProgress, setLoadedProgress] = useState<number | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  const [isDLNACasting, setIsDLNACasting] = useState(false);
  const [mediaError, setMediaError] = useState<{ code: number; message: string } | null>(null);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(10);
  const nextEpisodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Watch progress hook
  const { saveProgressImmediately } = useWatchProgress({
    contentId,
    onProgressLoaded: useCallback((progress: number) => {
      setLoadedProgress(progress);
    }, []),
  });

  // Google Cast hook
  const cast = useGoogleCast({
    mediaUrl: src,
    mediaTitle: title,
    onTimeUpdate: (time) => {
      setCurrentTime(time);
      saveProgressImmediately(time, cast.duration);
    },
  });

  // Picture-in-Picture hook
  const pip = usePictureInPicture(videoRef);

  // DLNA hook
  const dlna = useDLNA();

  // Check if source is HLS and detect available qualities
  useEffect(() => {
    const isHlsStream = src.includes('.m3u8');
    setIsHls(isHlsStream);
    
    if (isHlsStream) {
      // For Mux streams, these qualities are typically available
      setAvailableQualities(['auto', '1080', '720', '480']);
    }
  }, [src]);

  // Guard: avoid loading the player with an empty source (would trigger Error code: 4)
  useEffect(() => {
    if (!src || src.trim() === "") {
      setIsBuffering(false);
      setMediaError({ code: 4, message: "This video is not available yet." });
    }
  }, [src]);

  // Get the video source with quality parameter for HLS and CDN conversion
  const getVideoSource = () => {
    // Convert to CDN URL if it's a DigitalOcean Spaces URL
    const cdnSrc = toCdnUrl(src);
    
    if (!isHls || selectedQuality === 'auto') {
      return cdnSrc;
    }
    // For Mux HLS, we can append quality parameters
    // Mux uses rendition_order parameter for quality selection
    if (cdnSrc.includes('stream.mux.com')) {
      const baseUrl = cdnSrc.split('?')[0];
      return `${baseUrl}?rendition_order=desc&max_resolution=${selectedQuality}p`;
    }
    return cdnSrc;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      // Use loaded progress from DB if available, otherwise use initialProgress
      const startTime = loadedProgress !== null ? loadedProgress : initialProgress;
      if (startTime > 0) {
        video.currentTime = startTime;
      }
    };

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      // Show skip intro button during intro segment
      if (time >= introStartTime && time < introEndTime) {
        setShowSkipIntro(true);
      } else {
        setShowSkipIntro(false);
      }

      // Show next episode prompt near the end (last 30 seconds)
      if (nextEpisode && video.duration > 0 && time >= video.duration - 30) {
        if (!showNextEpisode) {
          setShowNextEpisode(true);
          setNextEpisodeCountdown(10);
        }
      }

      // Save progress every 10 seconds
      const now = Date.now();
      if (now - lastSaveTimeRef.current >= 10000) {
        lastSaveTimeRef.current = now;
        saveProgressImmediately(time, video.duration);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true); // Sync isPlaying state when video actually starts playing
    };
    const handleCanPlay = () => setIsBuffering(false);
    const handleLoadedData = () => setIsBuffering(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePauseEvent = () => setIsPlaying(false);

    const handleError = () => {
      setIsBuffering(false);
      const videoError = video.error;
      let errorMessage = "Video failed to load";
      let errorCode = 0;
      
      if (videoError) {
        errorCode = videoError.code;
        switch (videoError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = "Video playback was aborted";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = "Network error - check your connection or video URL";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = "Video format not supported or file corrupted";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "Video source not found (404) or format not supported";
            break;
          default:
            errorMessage = videoError.message || "Unknown video error";
        }
      }
      
      setMediaError({ code: errorCode, message: errorMessage });
    };

    const handlePause = () => {
      // Save progress immediately on pause
      saveProgressImmediately(video.currentTime, video.duration);
    };

    const handleEnded = () => {
      // Video ended - trigger next episode if available
      if (nextEpisode && onPlayNextEpisode) {
        onPlayNextEpisode(nextEpisode);
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleError);
    video.addEventListener("pause", handlePause);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePauseEvent);
    video.addEventListener("ended", handleEnded);

    return () => {
      // Save progress when unmounting
      if (video.currentTime > 0 && video.duration > 0) {
        saveProgressImmediately(video.currentTime, video.duration);
      }
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleError);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePauseEvent);
      video.removeEventListener("ended", handleEnded);
    };
  }, [initialProgress, loadedProgress, saveProgressImmediately, nextEpisode, onPlayNextEpisode, introStartTime, introEndTime, showNextEpisode]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isPlaying && showControls) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, showControls]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case "j":
          skip(-10);
          break;
        case "l":
          skip(10);
          break;
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          e.preventDefault();
          const percent = parseInt(e.key) / 10;
          video.currentTime = video.duration * percent;
          break;
        case "Escape":
          if (isFullscreen) toggleFullscreen();
          else if (pip.isActive) pip.exitPiP();
          else onBack();
          break;
        case "p":
          pip.togglePiP();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  };

  const adjustVolume = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = Math.max(0, Math.min(1, volume + delta));
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = value[0];
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handlePlaybackRateChange = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;
    
    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * video.duration;
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSkipIntro = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = introEndTime;
      setShowSkipIntro(false);
    }
  };

  const handlePlayNext = () => {
    if (nextEpisode && onPlayNextEpisode) {
      if (nextEpisodeTimerRef.current) {
        clearInterval(nextEpisodeTimerRef.current);
      }
      setShowNextEpisode(false);
      onPlayNextEpisode(nextEpisode);
    }
  };

  const handleCancelNextEpisode = () => {
    if (nextEpisodeTimerRef.current) {
      clearInterval(nextEpisodeTimerRef.current);
    }
    setShowNextEpisode(false);
  };

  // Next episode countdown timer
  useEffect(() => {
    if (showNextEpisode && nextEpisode && onPlayNextEpisode) {
      nextEpisodeTimerRef.current = setInterval(() => {
        setNextEpisodeCountdown((prev) => {
          if (prev <= 1) {
            if (nextEpisodeTimerRef.current) {
              clearInterval(nextEpisodeTimerRef.current);
            }
            onPlayNextEpisode(nextEpisode);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (nextEpisodeTimerRef.current) {
          clearInterval(nextEpisodeTimerRef.current);
        }
      };
    }
  }, [showNextEpisode, nextEpisode, onPlayNextEpisode]);

  const handleRetry = () => {
    setMediaError(null);
    setIsBuffering(true);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  // Show error screen if media failed to load
  if (mediaError) {
    return (
      <div
        ref={containerRef}
        className="relative w-full h-screen bg-background flex flex-col items-center justify-center gap-6"
      >
        <div className="text-center space-y-4 px-6 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="font-display text-xl">Video Playback Error</h2>
          <p className="text-muted-foreground text-sm">{mediaError.message}</p>
          <p className="text-xs text-muted-foreground/70">Error code: {mediaError.code}</p>
          <div className="flex gap-3 justify-center pt-4">
            <button
              onClick={handleRetry}
              className="px-6 py-2.5 rounded-lg bg-brand text-white font-medium hover:bg-brand/90 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={onBack}
              className="px-6 py-2.5 rounded-lg bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-background cursor-none"
      onMouseMove={() => setShowControls(true)}
      onClick={togglePlay}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={getVideoSource()}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
      />

      {/* Buffering Indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Loader2 className="h-16 w-16 animate-spin text-brand" />
        </div>
      )}

      {/* Skip Intro Button */}
      {showSkipIntro && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSkipIntro();
          }}
          className="absolute bottom-32 right-4 sm:right-8 z-20 px-6 py-3 bg-white/90 text-background font-semibold rounded-md hover:bg-white transition-colors shadow-lg"
        >
          Skip Intro
        </button>
      )}

      {/* Next Episode Prompt */}
      {showNextEpisode && nextEpisode && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-32 right-4 sm:right-8 z-20 bg-card/95 backdrop-blur-sm rounded-lg p-4 shadow-xl border border-border max-w-xs"
        >
          <p className="text-xs text-muted-foreground mb-2">Up Next</p>
          <div className="flex gap-3 items-center mb-3">
            {nextEpisode.thumbnailUrl && (
              <img
                src={nextEpisode.thumbnailUrl}
                alt={nextEpisode.title}
                className="w-20 h-12 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">E{nextEpisode.episodeNumber}: {nextEpisode.title}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePlayNext}
              className="flex-1 px-4 py-2 bg-brand text-white font-medium rounded hover:bg-brand/90 transition-colors text-sm"
            >
              Play Now ({nextEpisodeCountdown}s)
            </button>
            <button
              onClick={handleCancelNextEpisode}
              className="px-4 py-2 bg-secondary text-foreground font-medium rounded hover:bg-secondary/80 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          showControls ? "opacity-100 cursor-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background/80 to-transparent" />
        
        {/* Bottom Gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background/90 to-transparent" />

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-brand/80 flex items-center justify-center hover:bg-brand transition-colors"
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
          </button>
          <h2 className="font-display text-sm sm:text-xl truncate max-w-[60vw]">{title}</h2>
        </div>

        {/* Center Controls */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 sm:gap-8">
          <button
            onClick={() => skip(-10)}
            className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-background/50 flex items-center justify-center hover:bg-background/70 transition-colors"
          >
            <SkipBack className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          
          <button
            onClick={togglePlay}
            className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-brand flex items-center justify-center hover:bg-brand/90 transition-colors shadow-lg shadow-brand/30"
          >
            {isPlaying ? (
              <Pause className="h-7 w-7 sm:h-10 sm:w-10 text-primary-foreground" fill="currentColor" />
            ) : (
              <Play className="h-7 w-7 sm:h-10 sm:w-10 ml-1 text-primary-foreground" fill="currentColor" />
            )}
          </button>
          
          <button
            onClick={() => skip(10)}
            className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-background/50 flex items-center justify-center hover:bg-background/70 transition-colors"
          >
            <SkipForward className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Progress Bar with Markers */}
          <div
            ref={progressRef}
            className="h-1.5 bg-muted rounded-full cursor-pointer group relative"
            onClick={handleProgressClick}
          >
            {/* Intro marker */}
            {duration > 0 && introEndTime > introStartTime && (
              <div
                className="absolute top-0 h-full bg-blue-500/40 rounded-full pointer-events-none"
                style={{
                  left: `${(introStartTime / duration) * 100}%`,
                  width: `${((introEndTime - introStartTime) / duration) * 100}%`,
                }}
                title="Intro segment"
              />
            )}
            {/* Recap marker */}
            {duration > 0 && recapEndTime && recapStartTime !== undefined && recapEndTime > recapStartTime && (
              <div
                className="absolute top-0 h-full bg-purple-500/40 rounded-full pointer-events-none"
                style={{
                  left: `${(recapStartTime / duration) * 100}%`,
                  width: `${((recapEndTime - recapStartTime) / duration) * 100}%`,
                }}
                title="Recap segment"
              />
            )}
            {/* Played progress */}
            <div
              className="h-full bg-brand rounded-full relative transition-all group-hover:h-2 z-10"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-brand scale-0 group-hover:scale-100 transition-transform shadow-lg" />
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="hover:text-brand transition-colors"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>
              
              {/* Volume Control */}
              <div className="flex items-center gap-2 group">
                <button
                  onClick={toggleMute}
                  className="hover:text-brand transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                </button>
                <div className="w-0 group-hover:w-24 overflow-hidden transition-all duration-200">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="w-24"
                  />
                </div>
              </div>

              <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Quality Selection - only show for HLS streams */}
              {isHls && availableQualities.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="hidden sm:flex items-center gap-1 hover:text-brand transition-colors text-sm px-2 py-1 rounded bg-background/50">
                      {selectedQuality === 'auto' ? 'Auto' : `${selectedQuality}p`}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card">
                    {QUALITY_OPTIONS.filter(q => availableQualities.includes(q.value)).map((quality) => (
                      <DropdownMenuItem
                        key={quality.value}
                        onClick={() => setSelectedQuality(quality.value)}
                        className={cn(
                          "cursor-pointer",
                          selectedQuality === quality.value && "text-brand font-semibold"
                        )}
                      >
                        {quality.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Playback Speed */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden sm:flex items-center gap-1 hover:text-brand transition-colors text-sm">
                    <Settings className="h-5 w-5" />
                    {playbackRate}x
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card">
                  {PLAYBACK_RATES.map((rate) => (
                    <DropdownMenuItem
                      key={rate}
                      onClick={() => handlePlaybackRateChange(rate)}
                      className={cn(
                        "cursor-pointer",
                        playbackRate === rate && "text-brand font-semibold"
                      )}
                    >
                      {rate}x
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Cast Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "p-2 rounded-full transition-colors",
                      (cast.isConnected || isDLNACasting)
                        ? "text-brand bg-brand/20 hover:bg-brand/30" 
                        : "hover:text-brand hover:bg-muted"
                    )}
                    title="Cast to device"
                  >
                    <Cast className={cn("h-5 w-5", (cast.isConnected || isDLNACasting) && "fill-current")} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card min-w-[200px]">
                  {/* Google Cast */}
                  {cast.isAvailable && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          if (cast.isConnected) {
                            const video = videoRef.current;
                            if (video) {
                              video.pause();
                              setIsPlaying(false);
                              setIsCasting(true);
                              cast.loadMedia(src, title, undefined, video.currentTime);
                            }
                          } else {
                            cast.connect();
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <Cast className="mr-2 h-4 w-4" />
                        {cast.isConnected ? `Cast to ${cast.deviceName}` : 'Chromecast'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  {/* DLNA */}
                  <DropdownMenuItem
                    onClick={() => {
                      if (dlna.connectedDevice) {
                        const video = videoRef.current;
                        if (video) {
                          video.pause();
                          setIsPlaying(false);
                          setIsDLNACasting(true);
                          dlna.playMedia(src, title, video.currentTime);
                        }
                      } else {
                        dlna.scanForDevices();
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Tv className="mr-2 h-4 w-4" />
                    {dlna.isScanning ? 'Scanning...' : dlna.connectedDevice ? `DLNA: ${dlna.connectedDevice.name}` : 'DLNA/UPnP TV'}
                  </DropdownMenuItem>
                  
                  {dlna.devices.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      {dlna.devices.map((device) => (
                        <DropdownMenuItem
                          key={device.id}
                          onClick={() => dlna.connectToDevice(device)}
                          className="cursor-pointer"
                        >
                          <Tv className="mr-2 h-4 w-4" />
                          {device.name}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Picture-in-Picture Button */}
              {pip.isSupported && (
                <button
                  onClick={pip.togglePiP}
                  className={cn(
                    "p-2 rounded-full transition-colors hidden sm:block",
                    pip.isActive 
                      ? "text-brand bg-brand/20 hover:bg-brand/30" 
                      : "hover:text-brand hover:bg-muted"
                  )}
                  title={pip.isActive ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
                >
                  <PictureInPicture2 className="h-5 w-5" />
                </button>
              )}

              <button
                onClick={toggleFullscreen}
                className="hover:text-brand transition-colors"
              >
                {isFullscreen ? <Minimize className="h-5 w-5 sm:h-6 sm:w-6" /> : <Maximize className="h-5 w-5 sm:h-6 sm:w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts tooltip - hidden on mobile */}
        <div className="absolute bottom-20 right-4 text-xs text-muted-foreground opacity-50 hidden md:block">
          Space/K: Play | M: Mute | F: Fullscreen | P: PiP | ←→: Seek | ↑↓: Volume
        </div>
      </div>

      {/* Cast Controller - shown when casting via Chromecast */}
      {isCasting && cast.isConnected && (
        <CastController
          deviceName={cast.deviceName || 'Cast Device'}
          mediaTitle={title}
          isPlaying={cast.isPlaying}
          currentTime={cast.currentTime}
          duration={cast.duration}
          volume={cast.volume}
          isMuted={cast.isMuted}
          onPlay={cast.play}
          onPause={cast.pause}
          onSeek={cast.seek}
          onVolumeChange={cast.setVolume}
          onMuteToggle={() => cast.setMuted(!cast.isMuted)}
          onDisconnect={() => {
            cast.disconnect();
            setIsCasting(false);
          }}
        />
      )}

      {/* DLNA Controller - shown when casting via DLNA */}
      {isDLNACasting && dlna.connectedDevice && (
        <CastController
          deviceName={dlna.connectedDevice.name}
          mediaTitle={title}
          isPlaying={dlna.isPlaying}
          currentTime={dlna.currentTime}
          duration={dlna.duration}
          volume={1}
          isMuted={false}
          onPlay={dlna.play}
          onPause={dlna.pause}
          onSeek={dlna.seek}
          onVolumeChange={() => {}}
          onMuteToggle={() => {}}
          onDisconnect={() => {
            dlna.disconnect();
            setIsDLNACasting(false);
          }}
        />
      )}
    </div>
  );
};