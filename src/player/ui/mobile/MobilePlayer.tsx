import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Maximize, ChevronLeft, Loader2, Lock, Unlock, FastForward, Zap, Subtitles, Download
} from "lucide-react";
import { LogoOpener } from "@/components/LogoOpener";
import { useLogoOpener } from "@/hooks/useLogoOpener";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toCdnUrl } from "@/utils/cdnUrl";
import { createPlayer, formatTime, PlayerInstance } from "@/player";
import { CastToTVButton } from "@/components/cast/CastToTVButton";
import { Slider } from "@/components/ui/slider";
import { useSubtitles } from "@/hooks/useSubtitles";
import { SubtitleDisplay } from "@/components/SubtitleDisplay";
import { SubtitleSettings } from "@/components/SubtitleSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface NextEpisodeInfo {
  id: string;
  title: string;
  episodeNumber: number;
  seasonNumber?: number;
  thumbnail?: string;
}

interface MobilePlayerProps {
  src: string;
  title: string;
  contentId: string;
  episodeId?: string;
  initialProgress?: number;
  onClose: () => void;
  onEnded?: () => void;
  introStartTime?: number;
  introEndTime?: number;
  recapStartTime?: number;
  recapEndTime?: number;
  thumbnail?: string;
  // Next Episode props
  hasNextEpisode?: boolean;
  nextEpisode?: NextEpisodeInfo;
  onNextEpisode?: () => void;
}

const NEXT_EPISODE_COUNTDOWN_NORMAL = 10;
const NEXT_EPISODE_COUNTDOWN_BINGE = 5;

export const MobilePlayer = ({
  src,
  title,
  contentId,
  episodeId,
  initialProgress = 0,
  onClose,
  onEnded,
  introStartTime = 0,
  introEndTime = 90,
  recapStartTime,
  recapEndTime,
  thumbnail,
  hasNextEpisode = false,
  nextEpisode,
  onNextEpisode,
}: MobilePlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextEpisodeCountdownRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipRecap, setShowSkipRecap] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
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
      platform: 'mobile',
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
            // Show controls when paused
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            setShowControls(true);
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
          case 'volumechange':
            setIsMuted(data?.muted || false);
            if (!data?.muted) setShowUnmutePrompt(false);
            break;
        }
      },
    });

    playerRef.current = player;
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
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended && !isLocked) {
        setShowControls(false);
      }
    }, 5000);
  }, [isLocked]);

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
    if (!playerRef.current || isLocked) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  };

  const unmute = () => {
    if (!playerRef.current) return;
    playerRef.current.setMuted(false);
    setShowUnmutePrompt(false);
  };

  const handleSeek = (value: number[]) => {
    if (!playerRef.current || isLocked) return;
    playerRef.current.seek(value[0]);
  };

  const skip = (seconds: number) => {
    if (!playerRef.current || isLocked) return;
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
      // Lock to landscape on mobile
      try {
        await (screen.orientation as any)?.lock?.('landscape');
      } catch (e) {}
    } else {
      await document.exitFullscreen?.();
    }
  };

  const handleTap = () => {
    if (isLocked) {
      resetControlsTimeout();
      return;
    }
    resetControlsTimeout();
  };

  return (
    <>
      {/* Logo Opener */}
      <AnimatePresence>
        {showOpener && !openerComplete && (
          <LogoOpener onComplete={markOpenerComplete} />
        )}
      </AnimatePresence>

      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
        onTouchStart={handleTap}
        onClick={handleTap}
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
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
        </div>
      )}

      {/* Unmute Prompt */}
      {showUnmutePrompt && !isBuffering && (
        <button
          onClick={(e) => { e.stopPropagation(); unmute(); }}
          className="absolute top-4 right-4 px-4 py-2 bg-primary text-primary-foreground rounded-full font-medium flex items-center gap-2 z-20"
        >
          <VolumeX className="h-4 w-4" />
          Tap to unmute
        </button>
      )}

      {/* Resume Prompt */}
      {showResumePrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30" onClick={(e) => e.stopPropagation()}>
          <div className="bg-card p-6 rounded-2xl text-center max-w-xs mx-4">
            <Play className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-2">Resume watching?</h3>
            <p className="text-muted-foreground text-sm mb-4">You stopped at {formatTime(resumeFromTime)}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={handleStartOver} className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm">
                Start Over
              </button>
              <button onClick={handleResume} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock Controls Button (when locked) */}
      {isLocked && showControls && (
        <button
          onClick={(e) => { e.stopPropagation(); setIsLocked(false); }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-black/60 rounded-full z-20"
        >
          <Lock className="h-8 w-8 text-white" />
          <span className="sr-only">Unlock controls</span>
        </button>
      )}

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControls && !isLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Skip Intro Button */}
            {showSkipIntro && !showNextEpisode && !showSkipRecap && (
              <button
                onClick={(e) => { e.stopPropagation(); skipIntro(); }}
                className="absolute bottom-28 right-4 px-5 py-2.5 bg-foreground/90 text-background rounded-lg font-semibold z-10 pointer-events-auto"
              >
                Skip Intro
              </button>
            )}

            {/* Skip Recap Button */}
            {showSkipRecap && !showNextEpisode && (
              <button
                onClick={(e) => { e.stopPropagation(); skipRecap(); }}
                className="absolute bottom-28 right-4 px-5 py-2.5 bg-foreground/90 text-background rounded-lg font-semibold z-10 pointer-events-auto"
              >
                Skip Recap
              </button>
            )}

            {/* Next Episode Prompt */}
            {showNextEpisode && hasNextEpisode && nextEpisode && (
              <div 
                className="absolute bottom-28 left-4 right-4 bg-card/95 backdrop-blur-sm rounded-xl overflow-hidden shadow-2xl z-10 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Episode Thumbnail Preview */}
                <div className="relative w-full h-24 bg-muted">
                  {nextEpisode.thumbnail ? (
                    <img 
                      src={nextEpisode.thumbnail} 
                      alt={nextEpisode.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Play className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-12">
                    <p className="text-white/80 text-xs">Up Next</p>
                    <p className="text-white font-medium text-sm truncate">
                      {nextEpisode.seasonNumber ? `S${nextEpisode.seasonNumber} ` : ''}E{nextEpisode.episodeNumber} - {nextEpisode.title}
                    </p>
                  </div>
                  {/* Countdown circle */}
                  <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                    <span className="text-white font-bold">{nextEpisodeCountdown}</span>
                  </div>
                </div>
                
                {/* Controls */}
                <div className="p-2.5">
                  {/* Binge Mode Toggle */}
                  <button
                    onClick={toggleBingeMode}
                    className={cn(
                      "w-full mb-2 px-3 py-1 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors",
                      bingeMode 
                        ? "bg-primary/20 text-primary border border-primary/30" 
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Zap className={cn("h-3 w-3", bingeMode && "fill-primary")} />
                    Binge Mode {bingeMode ? 'ON' : 'OFF'}
                  </button>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={cancelNextEpisode}
                      className="flex-1 px-3 py-1.5 bg-muted text-foreground rounded-lg text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={playNextEpisodeNow}
                      className="flex-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <FastForward className="h-4 w-4" />
                      Play Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Top Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto safe-area-inset-top">
              <div className="flex items-center justify-between">
                <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="flex items-center gap-2 text-white">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <h2 className="text-white font-medium truncate max-w-[60%]">{title}</h2>
                <div className="flex items-center gap-2">
                  <CastToTVButton videoUrl={src} videoTitle={title} />
                  <button onClick={(e) => { e.stopPropagation(); setIsLocked(true); }} className="p-2 text-white">
                    <Unlock className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Center Controls */}
            <div className="absolute inset-0 flex items-center justify-center gap-12 pointer-events-auto">
              <button onClick={(e) => { e.stopPropagation(); skip(-10); }} className="p-3 bg-black/40 rounded-full">
                <SkipBack className="h-8 w-8 text-white" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-5 bg-white rounded-full">
                {isPlaying ? <Pause className="h-10 w-10 text-black" /> : <Play className="h-10 w-10 text-black ml-1" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); skip(10); }} className="p-3 bg-black/40 rounded-full">
                <SkipForward className="h-8 w-8 text-white" />
              </button>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto safe-area-inset-bottom">
              <div className="mb-3">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <div className="flex items-center gap-3">
                  {/* Download Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.info("Download started");
                    }} 
                    className="text-white"
                  >
                    <Download className="h-6 w-6" />
                  </button>
                  {/* Subtitles/CC Button */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        onClick={(e) => e.stopPropagation()} 
                        className={cn(
                          "text-white relative",
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
                  <SubtitleSettings className="text-white hover:bg-white/20 h-11 w-11 rounded-xl" />
                  
                  <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white">
                    <Maximize className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
};
