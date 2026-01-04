import { useEffect, useRef, useState, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, X, Loader2, RotateCcw
} from "lucide-react";
import { useMobileYouTubePlayer } from "@/contexts/MobileYouTubePlayerContext";
import { useYouTubeVideoProgress } from "@/hooks/useYouTubeVideoProgress";
import { useIsMobile } from "@/hooks/use-mobile";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const PersistentMobileYouTubePlayer = () => {
  const { state, closePlayer } = useMobileYouTubePlayer();
  const { isOpen, video } = state;
  const isMobile = useIsMobile();
  
  const uniqueId = useId().replace(/:/g, '-');
  const playerId = `mobile-youtube-player-${uniqueId}`;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const isInitializing = useRef(false);
  const latestVideoIdRef = useRef<string>('');
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
    if (!isOpen) return;
    
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
  }, [isOpen]);

  // Initialize player
  useEffect(() => {
    if (!apiReady || !isOpen || !video || playerRef.current || isInitializing.current) return;

    const playerElement = document.getElementById(playerId);
    if (!playerElement) return;

    isInitializing.current = true;
    latestVideoIdRef.current = video.videoId;

    try {
      playerRef.current = new window.YT.Player(playerId, {
        videoId: video.videoId,
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

            const saved = getProgress(video.videoId);
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
                if (playerRef.current?.getCurrentTime && duration > 0) {
                  saveProgress(latestVideoIdRef.current, playerRef.current.getCurrentTime(), duration);
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
  }, [apiReady, isOpen, video, playerId, getProgress, duration, saveProgress]);

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

  // Cleanup when closing
  useEffect(() => {
    if (!isOpen && playerRef.current) {
      try {
        if (playerRef.current.getCurrentTime && latestDurationRef.current > 0) {
          saveProgress(latestVideoIdRef.current, playerRef.current.getCurrentTime(), latestDurationRef.current);
        }
        playerRef.current.destroy();
      } catch (e) {}
      playerRef.current = null;
      isInitializing.current = false;
      setIsReady(false);
      setIsLoading(true);
      setShowResumePrompt(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [isOpen, saveProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

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
    closePlayer();
  };

  const handleTouchStart = () => {
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

  if (!isMobile) return null;

  return (
    <AnimatePresence>
      {isOpen && video && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black flex flex-col"
          onTouchStart={handleTouchStart}
        >
          {/* YouTube Player */}
          <div className="relative flex-1 w-full">
            <div id={playerId} className="absolute inset-0 w-full h-full" />

            {/* Loading Spinner */}
            {isLoading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50">
                <Loader2 className="h-12 w-12 text-white animate-spin" />
              </div>
            )}

            {/* Resume Prompt */}
            {showResumePrompt && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
                <div className="bg-card p-6 rounded-xl text-center max-w-sm mx-4">
                  <h3 className="text-lg font-semibold mb-2">Resume watching?</h3>
                  <p className="text-muted-foreground mb-4">
                    You left off at {formatTime(savedProgress)}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={handleStartOver}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Start Over
                    </Button>
                    <Button onClick={handleResume}>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Tap overlay for play/pause - exclude top area for close button */}
            <div className="absolute inset-0 z-10 pt-20" onClick={togglePlay} />

            {/* Controls Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showControls ? 1 : 0 }}
              className="absolute inset-0 z-20 pointer-events-none"
            >
              {/* Top Bar */}
              <div className="absolute top-0 left-0 right-0 p-4 pt-safe bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose();
                    }}
                    className="text-white hover:bg-white/20 active:bg-white/30 h-12 w-12 touch-manipulation cursor-pointer"
                    style={{ minWidth: 48, minHeight: 48 }}
                    type="button"
                  >
                    <X className="h-6 w-6" />
                  </Button>
                  <h3 className="text-white font-medium truncate flex-1">{video.title}</h3>
                </div>
              </div>

              {/* Center Play Button */}
              {!isPlaying && !isLoading && !showResumePrompt && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                  <Button
                    size="lg"
                    onClick={togglePlay}
                    className="w-20 h-20 rounded-full bg-primary/90 hover:bg-primary"
                  >
                    <Play className="h-10 w-10 fill-current" />
                  </Button>
                </div>
              )}

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 pb-safe bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
                {/* Progress Bar */}
                <div className="mb-4">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={1}
                    onValueChange={handleSeek}
                    className="cursor-pointer"
                  />
                </div>

                {/* Time & Controls */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/80 text-sm min-w-[80px]">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => skip(-10)} className="text-white hover:bg-white/20 h-10 w-10">
                      <SkipBack className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/20 h-12 w-12">
                      {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 fill-current" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => skip(10)} className="text-white hover:bg-white/20 h-10 w-10">
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 h-10 w-10">
                      {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/20 h-10 w-10">
                      {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
