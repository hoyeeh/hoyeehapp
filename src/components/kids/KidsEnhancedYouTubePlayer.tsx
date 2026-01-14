import { useEffect, useRef, useState, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, X, Loader2, RotateCcw, ArrowLeft
} from "lucide-react";
import { useYouTubeVideoProgress } from "@/hooks/useYouTubeVideoProgress";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface KidsEnhancedYouTubePlayerProps {
  videoId: string;
  title: string;
  onClose: () => void;
}

export const KidsEnhancedYouTubePlayer = ({ videoId, title, onClose }: KidsEnhancedYouTubePlayerProps) => {
  const uniqueId = useId().replace(/:/g, '-');
  const playerId = `kids-youtube-player-${uniqueId}`;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const isInitializing = useRef(false);
  const latestVideoIdRef = useRef<string>(videoId);
  const latestDurationRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedProgress, setSavedProgress] = useState(0);
  const [apiReady, setApiReady] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { saveProgress, getProgress } = useYouTubeVideoProgress();

  // Load YouTube API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      const checkApi = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setApiReady(true);
          clearInterval(checkApi);
        }
      }, 100);
      return () => clearInterval(checkApi);
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    const originalCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      originalCallback?.();
      setApiReady(true);
    };
  }, []);

  const startProgressTracking = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    progressInterval.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);
        if (latestDurationRef.current > 0 && Math.floor(time) % 10 === 0) {
          saveProgress(latestVideoIdRef.current, time, latestDurationRef.current);
        }
      }
    }, 500);
  }, [saveProgress]);

  // Initialize player - with retry mechanism for DOM element
  useEffect(() => {
    if (!apiReady || playerRef.current || isInitializing.current) return;

    const initializePlayer = () => {
      const playerElement = document.getElementById(playerId);
      if (!playerElement) {
        // Retry after a short delay if element isn't ready
        setTimeout(initializePlayer, 100);
        return;
      }

      isInitializing.current = true;
      latestVideoIdRef.current = videoId;

      try {
        playerRef.current = new window.YT.Player(playerId, {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            playsinline: 1,
            cc_load_policy: 0,
            origin: window.location.origin,
            endscreen: 0,
          },
          events: {
            onReady: (event: any) => {
              setIsReady(true);
              setIsLoading(false);
              isInitializing.current = false;

              const videoDuration = event.target.getDuration();
              setDuration(videoDuration);
              latestDurationRef.current = videoDuration;
              setVolume(event.target.getVolume());

              const saved = getProgress(videoId);
              if (saved > 10 && saved < videoDuration - 30) {
                setSavedProgress(saved);
                setShowResumePrompt(true);
                event.target.pauseVideo();
              } else {
                event.target.playVideo();
              }
            },
            onStateChange: (event: any) => {
              if (!window.YT?.PlayerState) return;

              switch (event.data) {
                case window.YT.PlayerState.PLAYING:
                  setIsPlaying(true);
                  setIsLoading(false);
                  startProgressTracking();
                  break;
                case window.YT.PlayerState.PAUSED:
                  setIsPlaying(false);
                  if (playerRef.current?.getCurrentTime && latestDurationRef.current > 0) {
                    saveProgress(latestVideoIdRef.current, playerRef.current.getCurrentTime(), latestDurationRef.current);
                  }
                  break;
                case window.YT.PlayerState.ENDED:
                  setIsPlaying(false);
                  break;
                case window.YT.PlayerState.BUFFERING:
                  setIsLoading(true);
                  break;
              }
            },
            onError: (event: any) => {
              console.error('YouTube player error:', event.data);
              setIsLoading(false);
              isInitializing.current = false;
            },
          },
        });
      } catch (error) {
        console.error('Failed to initialize YouTube player:', error);
        isInitializing.current = false;
      }
    };

    initializePlayer();
  }, [apiReady, videoId, playerId, getProgress, saveProgress, startProgressTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (playerRef.current) {
        try {
          if (playerRef.current.getCurrentTime && latestDurationRef.current > 0) {
            saveProgress(latestVideoIdRef.current, playerRef.current.getCurrentTime(), latestDurationRef.current);
          }
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [saveProgress]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isInFullscreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isInFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleResume = () => {
    setShowResumePrompt(false);
    if (playerRef.current) {
      playerRef.current.seekTo(savedProgress, true);
      playerRef.current.playVideo();
    }
  };

  const handleStartOver = () => {
    setShowResumePrompt(false);
    if (playerRef.current) {
      playerRef.current.seekTo(0, true);
      playerRef.current.playVideo();
    }
  };

  const togglePlay = () => {
    if (!playerRef.current || !isReady) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!playerRef.current) return;
    const time = value[0];
    playerRef.current.seekTo(time, true);
    setCurrentTime(time);
  };

  const skip = (seconds: number) => {
    if (!playerRef.current) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    playerRef.current.seekTo(newTime, true);
    setCurrentTime(newTime);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    const element = containerRef.current as any;
    const doc = document as any;

    try {
      const isCurrentlyFullscreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isCurrentlyFullscreen) {
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      console.warn('Fullscreen request failed:', error);
    }
  };

  const handleClose = () => {
    if (playerRef.current?.getCurrentTime && latestDurationRef.current > 0) {
      saveProgress(latestVideoIdRef.current, playerRef.current.getCurrentTime(), latestDurationRef.current);
    }
    onClose();
  };

  const handleInteraction = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 4000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#0A0A0F] flex flex-col"
        onMouseMove={handleInteraction}
        onTouchStart={handleInteraction}
      >
        {/* Kids-themed decorative elements */}
        <div className="absolute bottom-4 left-4 w-20 h-20 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-xl pointer-events-none" />
        <div className="absolute bottom-8 right-8 w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 blur-xl pointer-events-none" />
        <div className="absolute top-20 right-20 w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500/15 to-orange-500/15 blur-xl pointer-events-none" />

        {/* YouTube Player */}
        <div className="relative flex-1 w-full flex items-center justify-center p-4 pt-20">
          <div className="w-full max-w-5xl aspect-video rounded-3xl overflow-hidden shadow-2xl relative">
            <div id={playerId} className="absolute inset-0 w-full h-full" />

            {/* Loading Spinner */}
            {isLoading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 rounded-3xl">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-12 w-12 text-white animate-spin" />
                  <span className="text-white/70 text-sm font-medium">Loading video...</span>
                </div>
              </div>
            )}

            {/* Resume Prompt - Kids friendly */}
            {showResumePrompt && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 rounded-3xl">
                <div className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 p-8 rounded-3xl text-center max-w-sm mx-4 backdrop-blur-sm">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
                    <Play className="h-8 w-8 text-white fill-current" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Continue watching?</h3>
                  <p className="text-white/60 mb-6">
                    You stopped at {formatTime(savedProgress)}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button 
                      variant="outline" 
                      onClick={handleStartOver}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl px-5"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Start Over
                    </Button>
                    <Button 
                      onClick={handleResume}
                      className="bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white rounded-xl px-5"
                    >
                      <Play className="h-4 w-4 mr-2 fill-current" />
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Tap overlay for play/pause */}
            <div 
              className="absolute inset-0 z-10 rounded-3xl cursor-pointer" 
              onClick={togglePlay} 
            />

            {/* Center Play Button - Always clickable when visible */}
            {!isPlaying && !isLoading && !showResumePrompt && isReady && (
              <div className="absolute inset-0 z-30 flex items-center justify-center">
                <Button
                  size="lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="w-20 h-20 rounded-full bg-white hover:bg-white/90 shadow-2xl cursor-pointer"
                >
                  <Play className="h-10 w-10 fill-[#0A0A0F] text-[#0A0A0F] ml-1" />
                </Button>
              </div>
            )}

            {/* Controls Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showControls ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-20 pointer-events-none rounded-3xl overflow-hidden"
            >
              {/* Top gradient */}
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
              
              {/* Bottom gradient */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-auto">
                {/* Progress Bar */}
                <div className="mb-4">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={1}
                    onValueChange={handleSeek}
                    className="cursor-pointer [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:bg-white [&_.bg-primary]:bg-gradient-to-r [&_.bg-primary]:from-violet-500 [&_.bg-primary]:to-fuchsia-500"
                  />
                </div>

                {/* Time & Controls */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/80 text-sm font-medium min-w-[90px]">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => skip(-10)} 
                      className="text-white hover:bg-white/20 h-11 w-11 rounded-xl"
                    >
                      <SkipBack className="h-5 w-5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={togglePlay} 
                      className="text-white hover:bg-white/20 h-14 w-14 rounded-xl"
                    >
                      {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 fill-current" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => skip(10)} 
                      className="text-white hover:bg-white/20 h-11 w-11 rounded-xl"
                    >
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1 min-w-[90px] justify-end">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={toggleMute} 
                      className="text-white hover:bg-white/20 h-11 w-11 rounded-xl"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={toggleFullscreen} 
                      className="text-white hover:bg-white/20 h-11 w-11 rounded-xl"
                    >
                      {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Top Header - Responsive */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: showControls ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 pt-6 sm:pt-8 bg-gradient-to-b from-black/80 to-transparent safe-area-inset-top"
        >
          <div className="flex items-center justify-between max-w-7xl mx-auto gap-2">
            {/* Back Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 backdrop-blur-md text-white font-medium hover:from-violet-500/40 hover:to-fuchsia-500/40 active:from-violet-500/50 active:to-fuchsia-500/50 transition-all touch-manipulation cursor-pointer border border-white/20"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-sm sm:text-base hidden xs:inline">Back</span>
            </button>

            {/* Title - Hidden on small screens */}
            <h1 className="text-base sm:text-lg font-semibold text-white truncate max-w-[150px] sm:max-w-md mx-2 sm:mx-4 hidden sm:block">
              {title}
            </h1>

            {/* Close Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="flex items-center justify-center p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-rose-500/30 to-pink-500/30 backdrop-blur-md text-white hover:from-rose-500/40 hover:to-pink-500/40 active:from-rose-500/50 active:to-pink-500/50 transition-all touch-manipulation cursor-pointer border border-white/20"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
