import { useRef, useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  ArrowLeft, SkipBack, SkipForward, Loader2, Settings,
  PictureInPicture2, AlertCircle, FastForward, Zap, Subtitles
} from "lucide-react";
import { LogoOpener } from "@/components/LogoOpener";
import { useLogoOpener } from "@/hooks/useLogoOpener";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CastToTVButton } from "@/components/cast/CastToTVButton";
import { toast } from "sonner";
import { toCdnUrl } from "@/utils/cdnUrl";
import { createPlayer, formatTime, PlayerInstance, loadHlsJs } from "@/player";
import { useSubtitles } from "@/hooks/useSubtitles";
import { SubtitleDisplay } from "@/components/SubtitleDisplay";
import { SubtitleSettings } from "@/components/SubtitleSettings";

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
const NEXT_EPISODE_COUNTDOWN_NORMAL = 10;
const NEXT_EPISODE_COUNTDOWN_BINGE = 5;

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
  const [showSkipRecap, setShowSkipRecap] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeFromTime, setResumeFromTime] = useState(0);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [bingeMode, setBingeMode] = useState(() => localStorage.getItem('binge_mode') === 'true');
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(bingeMode ? NEXT_EPISODE_COUNTDOWN_BINGE : NEXT_EPISODE_COUNTDOWN_NORMAL);

  // Logo opener hook
  const { showOpener, openerComplete, markOpenerComplete } = useLogoOpener({
    contentId,
    episodeId,
  });

  // Subtitles hook
  const { 
    tracks: subtitleTracks, 
    activeTrack: activeSubtitleTrack, 
    currentCue,
    selectTrack: selectSubtitleTrack,
    updateCurrentCue,
    hasSubtitles,
  } = useSubtitles(contentId, episodeId);

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
            updateCurrentCue(data?.currentTime || 0);
            const time = data?.currentTime || 0;
            const videoDuration = data?.duration || duration;
            
            // Skip intro button logic
            if (introEndTime > introStartTime && time >= introStartTime && time < introEndTime) {
              setShowSkipIntro(true);
            } else {
              setShowSkipIntro(false);
            }
            
            // Skip recap button logic
            if (recapEndTime && recapStartTime !== undefined && recapEndTime > recapStartTime && time >= recapStartTime && time < recapEndTime) {
              setShowSkipRecap(true);
            } else {
              setShowSkipRecap(false);
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
  const countdownDuration = bingeMode ? NEXT_EPISODE_COUNTDOWN_BINGE : NEXT_EPISODE_COUNTDOWN_NORMAL;
  
  useEffect(() => {
    if (showNextEpisode && hasNextEpisode) {
      setNextEpisodeCountdown(countdownDuration);
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
      setNextEpisodeCountdown(countdownDuration);
    }
    
    return () => {
      if (nextEpisodeCountdownRef.current) clearInterval(nextEpisodeCountdownRef.current);
    };
  }, [showNextEpisode, hasNextEpisode, onNextEpisode, countdownDuration]);

  const toggleBingeMode = () => {
    const newValue = !bingeMode;
    setBingeMode(newValue);
    localStorage.setItem('binge_mode', newValue.toString());
  };

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

  const skipRecap = () => {
    if (!playerRef.current || !recapEndTime) return;
    playerRef.current.seek(recapEndTime);
    setShowSkipRecap(false);
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
    <>
      {/* Logo Opener */}
      <AnimatePresence>
        {showOpener && !openerComplete && (
          <LogoOpener onComplete={markOpenerComplete} />
        )}
      </AnimatePresence>

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

      {/* Subtitle Display */}
      {activeSubtitleTrack && <SubtitleDisplay cue={currentCue} />}

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
        {/* Skip Intro Button - Hidden, managed by admin */}

        {/* Skip Recap Button */}
        {showSkipRecap && !showNextEpisode && (
          <button
            onClick={(e) => { e.stopPropagation(); skipRecap(); }}
            className="absolute bottom-32 right-8 px-6 py-3 bg-foreground/90 text-background rounded-lg font-semibold hover:bg-foreground transition-colors z-10 pointer-events-auto"
          >
            Skip Recap
          </button>
        )}

        {/* Next Episode Prompt */}
        {showNextEpisode && hasNextEpisode && nextEpisode && (
          <div 
            className="absolute bottom-32 right-8 bg-card/95 backdrop-blur-sm rounded-xl shadow-2xl z-10 pointer-events-auto min-w-[360px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Episode Thumbnail Preview */}
            <div className="relative w-full h-32 bg-muted">
              {nextEpisode.thumbnail ? (
                <img 
                  src={nextEpisode.thumbnail} 
                  alt={nextEpisode.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Play className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3">
                <p className="text-white/80 text-xs">Up Next</p>
                <p className="text-white font-medium text-sm truncate">
                  {nextEpisode.seasonNumber ? `S${nextEpisode.seasonNumber} ` : ''}E{nextEpisode.episodeNumber} - {nextEpisode.title}
                </p>
              </div>
              {/* Countdown circle */}
              <div className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{nextEpisodeCountdown}</span>
              </div>
            </div>
            
            {/* Controls */}
            <div className="p-3">
              {/* Binge Mode Toggle */}
              <button
                onClick={toggleBingeMode}
                className={cn(
                  "w-full mb-2 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors",
                  bingeMode 
                    ? "bg-primary/20 text-primary border border-primary/30" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Zap className={cn("h-3.5 w-3.5", bingeMode && "fill-primary")} />
                Binge Mode {bingeMode ? 'ON' : 'OFF'} ({bingeMode ? '5s' : '10s'})
              </button>
              
              <div className="flex gap-2">
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
              {/* Subtitles/CC Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    onClick={(e) => e.stopPropagation()} 
                    className={cn(
                      "text-white hover:text-white/80 relative",
                      activeSubtitleTrack && "text-primary"
                    )}
                  >
                    <Subtitles className="h-6 w-6" />
                    {activeSubtitleTrack && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => selectSubtitleTrack(null)}
                    className={cn(!activeSubtitleTrack && "bg-accent")}
                  >
                    Off
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {subtitleTracks.map((track) => (
                    <DropdownMenuItem
                      key={track.id}
                      onClick={() => selectSubtitleTrack(track)}
                      className={cn(activeSubtitleTrack?.id === track.id && "bg-accent")}
                    >
                      {track.label}
                    </DropdownMenuItem>
                  ))}
                  {subtitleTracks.length === 0 && (
                    <DropdownMenuItem disabled>
                      No subtitles available
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Subtitle Settings */}
              <SubtitleSettings className="text-white hover:text-white/80" />
              
              {/* Playback Speed */}
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
    </>
  );
};
