import { useEffect, useRef, useState, useCallback, useId } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, X, Loader2
} from "lucide-react";
import { useYouTubeVideoProgress } from "@/hooks/useYouTubeVideoProgress";

interface YouTubeVideoPlayerProps {
  videoId: string;
  title?: string;
  onClose?: () => void;
  onEnded?: () => void;
  autoplay?: boolean;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const YouTubeVideoPlayer = ({
  videoId,
  title,
  onClose,
  onEnded,
  autoplay = true,
}: YouTubeVideoPlayerProps) => {
  const uniqueId = useId().replace(/:/g, '-');
  const playerId = `youtube-player-${uniqueId}`;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const hasResumed = useRef(false);
  const isInitializing = useRef(false);

  // Keep latest values for cleanup without re-running the cleanup effect
  const latestVideoIdRef = useRef(videoId);
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

  useEffect(() => {
    latestVideoIdRef.current = videoId;
  }, [videoId]);

  useEffect(() => {
    latestDurationRef.current = duration;
  }, [duration]);

  // Check if YouTube API is loaded
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      // Wait for it to load
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

  // Initialize player when API is ready
  useEffect(() => {
    if (!apiReady || !containerRef.current || playerRef.current || isInitializing.current) return;
    
    const playerElement = document.getElementById(playerId);
    if (!playerElement) return;

    isInitializing.current = true;

    try {
      playerRef.current = new window.YT.Player(playerId, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
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
            console.log('YouTube player ready');
            setIsReady(true);
            setIsLoading(false);
            isInitializing.current = false;
            
            const videoDuration = event.target.getDuration();
            setDuration(videoDuration);
            setVolume(event.target.getVolume());
            
            // Check for saved progress
            const saved = getProgress(videoId);
            if (saved > 10 && saved < videoDuration - 30) {
              setSavedProgress(saved);
              setShowResumePrompt(true);
              event.target.pauseVideo();
            } else if (autoplay) {
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
                  saveProgress(videoId, playerRef.current.getCurrentTime(), duration);
                }
                break;
              case window.YT.PlayerState.ENDED:
                setIsPlaying(false);
                onEnded?.();
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
  }, [apiReady, playerId, videoId, autoplay, getProgress]);

  const startProgressTracking = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    progressInterval.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);
        if (duration > 0 && Math.floor(time) % 10 === 0) {
          saveProgress(videoId, time, duration);
        }
      }
    }, 500);
  }, [duration, saveProgress, videoId]);

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

  const handleVolumeChange = (value: number[]) => {
    if (!playerRef.current) return;
    const vol = value[0];
    playerRef.current.setVolume(vol);
    setVolume(vol);
    if (vol === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
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

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (playerRef.current) {
        try {
          const latestVideoId = latestVideoIdRef.current;
          const latestDuration = latestDurationRef.current;

          if (playerRef.current.getCurrentTime && latestDuration > 0) {
            saveProgress(latestVideoId, playerRef.current.getCurrentTime(), latestDuration);
          }
          playerRef.current.destroy();
        } catch (e) {
          // Player may already be destroyed
        }
        playerRef.current = null;
      }
      isInitializing.current = false;
    };
  }, [saveProgress]);

  // Handle video ID changes for existing player
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    
    try {
      const iframe = playerRef.current.getIframe?.();
      if (iframe && playerRef.current.loadVideoById) {
        setIsLoading(true);
        hasResumed.current = false;
        playerRef.current.loadVideoById(videoId);
      }
    } catch (error) {
      console.warn('Could not change video:', error);
    }
  }, [videoId]); // Only react to videoId changes, not isReady

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video min-h-[300px] bg-black rounded-xl overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* YouTube Player Container */}
      <div className="absolute inset-0">
        <div id={playerId} className="w-full h-full" />
      </div>

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
                Start Over
              </Button>
              <Button onClick={handleResume}>
                Resume
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay for click to play/pause */}
      <div
        className="absolute inset-0 z-10"
        onClick={togglePlay}
      />

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 z-20 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </Button>
              )}
              {title && (
                <h3 className="text-white font-medium truncate max-w-md">{title}</h3>
              )}
            </div>
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
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
          <div className="mb-4 px-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-center gap-1">
            <span className="text-white/80 text-sm min-w-[80px] text-center">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex items-center gap-1 mx-4">
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

            <div className="flex items-center gap-1 group">
              <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 h-10 w-10">
                {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <div className="w-0 group-hover:w-20 overflow-hidden transition-all duration-200">
                <Slider value={[isMuted ? 0 : volume]} max={100} step={1} onValueChange={handleVolumeChange} />
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/20 h-10 w-10 ml-2">
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
