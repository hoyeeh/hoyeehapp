import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  ArrowLeft, SkipBack, SkipForward, Loader2, Settings,
  PictureInPicture2, AlertCircle, FastForward
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CastToTVButton } from "@/components/cast/CastToTVButton";
import { toast } from "sonner";
import { toCdnUrl } from "@/utils/cdnUrl";
import { createPlayer, formatTime, PlayerInstance, loadHlsJs } from "@/player";

export interface NextEpisodeInfo {
  id: string;
  title: string;
  episodeNumber: number;
  seasonNumber?: number;
  thumbnail?: string;
}

interface DesktopPlayerProps {
  src: string;
  title: string;
  contentId: string;
  episodeId?: string;
  initialProgress?: number;
  onBack: () => void;
  introStartTime?: number;
  introEndTime?: number;
  recapStartTime?: number;
  recapEndTime?: number;
  onEnded?: () => void;
  thumbnail?: string;
  // Next Episode props
  hasNextEpisode?: boolean;
  nextEpisode?: NextEpisodeInfo;
  onNextEpisode?: () => void;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const NEXT_EPISODE_COUNTDOWN_SECONDS = 10;

export const DesktopPlayer = ({
  src,
  title,
  contentId,
  episodeId,
  initialProgress = 0,
  onBack,
  introStartTime = 0,
  introEndTime = 90,
  recapStartTime,
  recapEndTime,
  onEnded,
  thumbnail,
  hasNextEpisode = false,
  nextEpisode,
  onNextEpisode,
}: DesktopPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextEpisodeCountdownRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mediaError, setMediaError] = useState<{ code: number; message: string } | null>(null);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeFromTime, setResumeFromTime] = useState(0);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(NEXT_EPISODE_COUNTDOWN_SECONDS);

  // Initialize player engine
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const player = createPlayer({
      videoEl: video,
      platform: 'desktop',
      debug: localStorage.getItem('HOYEEH_DEBUG') === '1',
      onEvent: (event, data: any) => {
        switch (event) {
          case 'loadstart':
            setIsBuffering(true);
            break;
          case 'loadedmetadata':
            setDuration(data?.duration || 0);
            if (initialProgress > 30 && data?.duration && initialProgress < data.duration * 0.95) {
              setResumeFromTime(initialProgress);
              setShowResumePrompt(true);
              player.pause();
            } else if (initialProgress > 0) {
              player.seek(initialProgress);
            }
            break;
          case 'timeupdate':
            setCurrentTime(data?.currentTime || 0);
            const time = data?.currentTime || 0;
            const videoDuration = data?.duration || duration;
            
            // Skip intro button logic
            if (introEndTime > introStartTime && time >= introStartTime && time < introEndTime) {
              setShowSkipIntro(true);
            } else {
              setShowSkipIntro(false);
            }
            
            // Next episode prompt - show when 30 seconds from end
            if (hasNextEpisode && videoDuration > 0 && time >= videoDuration - 30 && time < videoDuration) {
              setShowNextEpisode(true);
            } else if (time < videoDuration - 30) {
              setShowNextEpisode(false);
            }
            break;
          case 'play':
            setIsPlaying(true);
            setIsBuffering(false);
            break;
          case 'pause':
            setIsPlaying(false);
            break;
          case 'waiting':
            setIsBuffering(true);
            break;
          case 'playing':
            setIsBuffering(false);
            setIsPlaying(true);
            // Auto-hide controls after 5 seconds when video starts playing
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 5000);
            break;
          case 'ended':
            setIsPlaying(false);
            onEnded?.();
            break;
          case 'error':
            setMediaError({ code: data?.code || 0, message: data?.message || 'Unknown error' });
            setIsBuffering(false);
            break;
          case 'volumechange':
            setVolume(data?.volume || 0);
            setIsMuted(data?.muted || false);
            break;
        }
      },
    });

    playerRef.current = player;

    // Load the video
    const cdnSrc = toCdnUrl(src);
    player.load(cdnSrc, 0, { title, contentId, episodeId, thumbnail });

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [src, contentId]);

  // Controls visibility - 5 second auto-hide
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        setShowControls(false);
      }
    }, 5000);
  }, []);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Next episode countdown
  useEffect(() => {
    if (showNextEpisode && hasNextEpisode) {
      setNextEpisodeCountdown(NEXT_EPISODE_COUNTDOWN_SECONDS);
      nextEpisodeCountdownRef.current = setInterval(() => {
        setNextEpisodeCountdown(prev => {
          if (prev <= 1) {
            if (nextEpisodeCountdownRef.current) clearInterval(nextEpisodeCountdownRef.current);
            onNextEpisode?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (nextEpisodeCountdownRef.current) {
        clearInterval(nextEpisodeCountdownRef.current);
        nextEpisodeCountdownRef.current = null;
      }
      setNextEpisodeCountdown(NEXT_EPISODE_COUNTDOWN_SECONDS);
    }
    
    return () => {
      if (nextEpisodeCountdownRef.current) clearInterval(nextEpisodeCountdownRef.current);
    };
  }, [showNextEpisode, hasNextEpisode, onNextEpisode]);

  const cancelNextEpisode = () => {
    if (nextEpisodeCountdownRef.current) clearInterval(nextEpisodeCountdownRef.current);
    setShowNextEpisode(false);
  };

  const playNextEpisodeNow = () => {
    if (nextEpisodeCountdownRef.current) clearInterval(nextEpisodeCountdownRef.current);
    setShowNextEpisode(false);
    onNextEpisode?.();
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    playerRef.current.setMuted(!isMuted);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!playerRef.current) return;
    const vol = value[0];
    playerRef.current.setVolume(vol);
    if (vol > 0 && isMuted) {
      playerRef.current.setMuted(false);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!playerRef.current) return;
    playerRef.current.seek(value[0]);
  };

  const skip = (seconds: number) => {
    if (!playerRef.current) return;
    playerRef.current.seek(currentTime + seconds);
  };

  const skipIntro = () => {
    if (!playerRef.current) return;
    playerRef.current.seek(introEndTime);
    setShowSkipIntro(false);
  };

  const handleResume = () => {
    setShowResumePrompt(false);
    playerRef.current?.seek(resumeFromTime);
    playerRef.current?.play();
  };

  const handleStartOver = () => {
    setShowResumePrompt(false);
    playerRef.current?.seek(0);
    playerRef.current?.play();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      await containerRef.current.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  if (mediaError) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Video Error</h2>
          <p className="text-muted-foreground mb-4">{mediaError.message}</p>
          <button onClick={onBack} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black"
      onMouseMove={resetControlsTimeout}
      onClick={togglePlay}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted={isMuted}
        poster={thumbnail}
      />

      {/* Buffering Indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
        </div>
      )}

      {/* Resume Prompt */}
      {showResumePrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20" onClick={(e) => e.stopPropagation()}>
          <div className="bg-card p-8 rounded-2xl text-center max-w-sm">
            <Play className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">Resume watching?</h3>
            <p className="text-muted-foreground mb-6">You stopped at {formatTime(resumeFromTime)}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleStartOver} className="px-4 py-2 bg-muted text-foreground rounded-lg">
                Start Over
              </button>
              <button onClick={handleResume} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300 pointer-events-none",
          showControls ? "opacity-100" : "opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Skip Intro Button - inside controls overlay so it hides with controls */}
        {showSkipIntro && !showNextEpisode && (
          <button
            onClick={(e) => { e.stopPropagation(); skipIntro(); }}
            className="absolute bottom-32 right-8 px-6 py-3 bg-foreground/90 text-background rounded-lg font-semibold hover:bg-foreground transition-colors z-10 pointer-events-auto"
          >
            Skip Intro
          </button>
        )}

        {/* Next Episode Prompt */}
        {showNextEpisode && hasNextEpisode && nextEpisode && (
          <div 
            className="absolute bottom-32 right-8 bg-card/95 backdrop-blur-sm rounded-xl p-4 shadow-2xl z-10 pointer-events-auto min-w-[320px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-4">
              {nextEpisode.thumbnail && (
                <div className="relative w-28 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src={nextEpisode.thumbnail} 
                    alt={nextEpisode.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="h-6 w-6 text-white" />
                  </div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground text-xs mb-1">Up Next</p>
                <p className="text-foreground font-medium text-sm truncate">
                  {nextEpisode.seasonNumber ? `S${nextEpisode.seasonNumber} ` : ''}E{nextEpisode.episodeNumber} - {nextEpisode.title}
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  Playing in {nextEpisodeCountdown}s
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={cancelNextEpisode}
                className="flex-1 px-3 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={playNextEpisodeNow}
                className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
              >
                <FastForward className="h-4 w-4" />
                Play Now
              </button>
            </div>
          </div>
        )}

        {/* Top Gradient & Controls */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
          <div className="flex items-center justify-between p-4">
            <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-white hover:text-white/80">
              <ArrowLeft className="h-6 w-6" />
              <span className="font-medium">{title}</span>
            </button>
            <div className="flex items-center gap-2">
              <CastToTVButton videoUrl={src} videoTitle={title} />
            </div>
          </div>
        </div>

        {/* Bottom Gradient & Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 pointer-events-auto">
          {/* Progress Bar */}
          <div className="mb-4">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-white/80">
                {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); skip(-10); }} className="text-white hover:text-white/80">
                <SkipBack className="h-6 w-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); skip(10); }} className="text-white hover:text-white/80">
                <SkipForward className="h-6 w-6" />
              </button>
              <div className="flex items-center gap-2 group">
                <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-white/80">
                  {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                </button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-24 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <span className="text-white/80 text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button onClick={(e) => e.stopPropagation()} className="text-white hover:text-white/80">
                    <Settings className="h-6 w-6" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {PLAYBACK_RATES.map((rate) => (
                    <DropdownMenuItem
                      key={rate}
                      onClick={() => handlePlaybackRateChange(rate)}
                      className={cn(playbackRate === rate && "bg-accent")}
                    >
                      {rate}x
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-white/80">
                {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
