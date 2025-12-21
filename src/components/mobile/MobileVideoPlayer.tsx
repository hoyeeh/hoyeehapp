import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  Maximize, Minimize, ChevronLeft, Settings, Cast, Loader2,
  RotateCcw, FastForward, RefreshCw, AlertCircle, WifiOff,
  PictureInPicture2, Wifi, Signal, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Content } from "@/types";
import { useWatchProgress } from "@/hooks/useWatchProgress";
import { MobileCastSheet } from "./MobileCastSheet";
import { useCast } from "@/contexts/CastContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { usePictureInPicture } from "@/hooks/usePictureInPicture";
import { useCastHistory } from "@/hooks/useCastHistory";
import { toCdnUrl } from "@/utils/cdnUrl";

interface MobileVideoPlayerProps {
  content: Content;
  videoUrl: string;
  title: string;
  episodeTitle?: string;
  episodeId?: string;
  onClose: () => void;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  introStartTime?: number;
  introEndTime?: number;
  recapStartTime?: number;
  recapEndTime?: number;
  thumbnail?: string;
}

// Available quality options
const QUALITY_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "1080p", value: "1080" },
  { label: "720p", value: "720" },
  { label: "480p", value: "480" },
  { label: "360p", value: "360" },
];

// Playback speed options (added 0.5x)
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function MobileVideoPlayer({
  content,
  videoUrl,
  title,
  episodeTitle,
  episodeId,
  onClose,
  onNextEpisode,
  hasNextEpisode,
  introStartTime,
  introEndTime,
  recapStartTime,
  recapEndTime,
  thumbnail,
}: MobileVideoPlayerProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapSideRef = useRef<"left" | "right" | null>(null);
  const { user } = useAuth();

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(true);
  const [showTapToPlay, setShowTapToPlay] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(10);
  const [showCastSheet, setShowCastSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [skipAmount, setSkipAmount] = useState<{ side: "left" | "right"; amount: number } | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedProgress, setSavedProgress] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState<{ code: number; message: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // New states for desktop feature parity
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(100);
  const [settingsTab, setSettingsTab] = useState<"speed" | "quality">("speed");

  // Hooks
  const { saveProgressImmediately } = useWatchProgress({
    contentId: content.id,
    onProgressLoaded: (progress) => {
      if (progress > 0 && duration > 0) {
        const progressRatio = progress / duration;
        if (progressRatio < 0.95) {
          setSavedProgress(progress);
          setShowResumePrompt(true);
        }
      }
    },
  });
  const cast = useCast();
  const networkQuality = useNetworkQuality();
  const pip = usePictureInPicture(videoRef);
  const castHistory = useCastHistory();

  // Check if video is HLS
  const isHls = videoUrl?.includes('.m3u8');

  // Get video source with CDN and quality
  const getVideoSource = useCallback(() => {
    if (!videoUrl) return '';
    
    let url = toCdnUrl(videoUrl);
    
    // For HLS, append quality parameter if not auto
    if (isHls && selectedQuality !== 'auto') {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}quality=${selectedQuality}`;
    }
    
    return url;
  }, [videoUrl, isHls, selectedQuality]);

  // Auto-reconnect to last cast device
  useEffect(() => {
    if (castHistory.lastUsedDevice && !cast.isConnected && !cast.isConnecting) {
      const timeSinceLastUse = Date.now() - castHistory.lastUsedDevice.lastUsed;
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (timeSinceLastUse < twentyFourHours && castHistory.lastUsedDevice.type !== 'airplay') {
        // Attempt to reconnect to last device (exclude airplay as it uses different type)
        const device = {
          ...castHistory.lastUsedDevice,
          type: castHistory.lastUsedDevice.type as 'chromecast' | 'dlna' | 'remote',
        };
        cast.reconnectToDevice?.(device);
      }
    }
  }, [castHistory.lastUsedDevice, cast.isConnected, cast.isConnecting]);

  // Auto-play with muted audio
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const attemptPlay = async () => {
      try {
        video.muted = true;
        setIsMuted(true);
        await video.play();
        setIsPlaying(true);
        setShowTapToPlay(false);
        setShowUnmutePrompt(true);
      } catch (error) {
        console.log("[MobileVideoPlayer] Autoplay blocked:", error);
        setShowTapToPlay(true);
        setIsPlaying(false);
      }
    };

    attemptPlay();
  }, [videoUrl, selectedQuality]);

  // Hide controls after inactivity
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings && !showCastSheet) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, showSettings, showCastSheet]);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);

  // Skip intro visibility
  useEffect(() => {
    if (introStartTime && introEndTime) {
      const isInIntro = currentTime >= introStartTime && currentTime < introEndTime;
      setShowSkipIntro(isInIntro);
    }
  }, [currentTime, introStartTime, introEndTime]);

  // Next episode prompt
  useEffect(() => {
    if (!hasNextEpisode || !duration) return;
    
    const timeLeft = duration - currentTime;
    if (timeLeft <= 30 && timeLeft > 0) {
      setShowNextEpisode(true);
      setNextEpisodeCountdown(Math.ceil(timeLeft));
    } else {
      setShowNextEpisode(false);
    }
  }, [currentTime, duration, hasNextEpisode]);

  // Auto-play next episode countdown
  useEffect(() => {
    if (!showNextEpisode || nextEpisodeCountdown <= 0) return;

    const timer = setInterval(() => {
      setNextEpisodeCountdown((prev) => {
        if (prev <= 1) {
          onNextEpisode?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showNextEpisode, onNextEpisode]);

  // Save progress periodically
  useEffect(() => {
    if (!isPlaying || !duration) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && duration > 0) {
        saveProgressImmediately(video.currentTime, duration);
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [isPlaying, duration, saveProgressImmediately]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      setIsBuffering(false);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
      
      // Update buffered progress
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        setBufferedProgress((buffered / video.duration) * 100);
      }
    }
  };

  const handleWaiting = () => setIsBuffering(true);
  const handleCanPlay = () => {
    setIsBuffering(false);
    setMediaError(null);
  };
  const handleEnded = () => {
    setIsPlaying(false);
    if (hasNextEpisode && onNextEpisode) {
      onNextEpisode();
    }
  };

  // Error handler with retry logic
  const handleError = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setIsBuffering(false);
    const videoError = video.error;
    let errorMessage = "Video failed to load";
    let errorCode = 0;
    
    if (videoError) {
      errorCode = videoError.code;
      switch (videoError.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = "Video playback was interrupted";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = "Network error - check your connection";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = "Video format not supported";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = "Video not available - please try again later";
          break;
        default:
          errorMessage = videoError.message || "Unknown error occurred";
      }
    }
    
    console.error("[MobileVideoPlayer] Video error:", errorCode, errorMessage);
    setMediaError({ code: errorCode, message: errorMessage });
  }, []);

  // Retry function
  const handleRetry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    setMediaError(null);
    setIsBuffering(true);
    setRetryCount((prev) => prev + 1);
    
    // Reload the video
    video.load();
    video.play()
      .then(() => {
        setIsPlaying(true);
        setShowTapToPlay(false);
      })
      .catch((error) => {
        console.log("[MobileVideoPlayer] Retry play failed:", error);
        setShowTapToPlay(true);
      });
  }, []);

  // Control handlers
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        setShowTapToPlay(false);
      }).catch(() => {
        toast.error("Unable to play video");
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
    setShowUnmutePrompt(false);
    
    // Show volume indicator animation
    if (!video.muted) {
      setVolumeLevel(Math.round(video.volume * 100));
      setShowVolumeIndicator(true);
      setTimeout(() => setShowVolumeIndicator(false), 1500);
    }
    
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
    video.currentTime = newTime;
    setCurrentTime(newTime);
    resetControlsTimeout();
  }, [duration, resetControlsTimeout]);

  const skipIntro = useCallback(() => {
    const video = videoRef.current;
    if (video && introEndTime) {
      video.currentTime = introEndTime;
      setCurrentTime(introEndTime);
      setShowSkipIntro(false);
    }
  }, [introEndTime]);

  const skipRecap = useCallback(() => {
    const video = videoRef.current;
    if (video && recapEndTime) {
      video.currentTime = recapEndTime;
      setCurrentTime(recapEndTime);
    }
  }, [recapEndTime]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
        // Try to lock orientation to landscape
        try {
          await (screen.orientation as any)?.lock?.("landscape");
        } catch {}
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        try {
          (screen.orientation as any)?.unlock?.();
        } catch {}
      }
    } catch (error) {
      console.error("[MobileVideoPlayer] Fullscreen error:", error);
    }
  }, []);

  const handleResume = useCallback(() => {
    const video = videoRef.current;
    if (video && savedProgress) {
      video.currentTime = savedProgress;
    }
    setShowResumePrompt(false);
  }, [savedProgress]);

  const handleStartOver = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
    }
    setShowResumePrompt(false);
  }, []);

  // Double tap to skip
  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const now = Date.now();
    const rect = container.getBoundingClientRect();
    const x = "touches" in e ? e.changedTouches[0].clientX : e.clientX;
    const tapSide: "left" | "right" = x < rect.left + rect.width / 2 ? "left" : "right";

    // Check for double tap
    if (now - lastTapTimeRef.current < 300 && lastTapSideRef.current === tapSide) {
      // Double tap detected
      if (doubleTapTimeoutRef.current) {
        clearTimeout(doubleTapTimeoutRef.current);
      }
      
      const skipSeconds = tapSide === "left" ? -10 : 10;
      skip(skipSeconds);
      setSkipAmount({ side: tapSide, amount: Math.abs(skipSeconds) });
      
      setTimeout(() => setSkipAmount(null), 800);
    } else {
      // Single tap - schedule controls toggle
      doubleTapTimeoutRef.current = setTimeout(() => {
        setShowControls((prev) => !prev);
        resetControlsTimeout();
      }, 250);
    }

    lastTapTimeRef.current = now;
    lastTapSideRef.current = tapSide;
  }, [skip, resetControlsTimeout]);

  const changePlaybackSpeed = useCallback((speed: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  }, []);

  const changeQuality = useCallback((quality: string) => {
    setSelectedQuality(quality);
    toast.success(`Quality set to ${quality === 'auto' ? 'Auto' : quality + 'p'}`);
  }, []);

  const handleBack = useCallback(() => {
    // Save progress before closing
    const video = videoRef.current;
    if (video && duration > 0) {
      saveProgressImmediately(video.currentTime, duration);
    }
    onClose();
  }, [duration, saveProgressImmediately, onClose]);

  // Handle casting
  const handleCastVideo = useCallback(async () => {
    if (cast.isConnected) {
      const video = videoRef.current;
      const currentVideoTime = video?.currentTime || 0;
      
      // Pause local video
      video?.pause();
      setIsPlaying(false);
      
      // Load on cast device
      await cast.loadVideo(
        getVideoSource(),
        episodeTitle || title,
        thumbnail || content.thumbnailUrl,
        currentVideoTime,
        duration
      );
      
      toast.success(`Casting to ${cast.connectedDevice?.name}`);
    } else {
      setShowCastSheet(true);
    }
  }, [cast, getVideoSource, title, episodeTitle, thumbnail, content.thumbnailUrl, duration]);

  // Toggle PiP
  const handleTogglePiP = useCallback(async () => {
    await pip.togglePiP();
    resetControlsTimeout();
  }, [pip, resetControlsTimeout]);

  // Format time
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Calculate progress bar marker positions
  const getMarkerPosition = (time: number) => {
    if (!duration || time < 0) return -1;
    return (time / duration) * 100;
  };

  // Get network status text
  const getNetworkStatusText = () => {
    if (!networkQuality.isOnline) return "Offline";
    if (networkQuality.effectiveType === 'slow-2g' || networkQuality.effectiveType === '2g') {
      return "Slow connection";
    }
    if (networkQuality.downlink) {
      return `${networkQuality.effectiveType?.toUpperCase()} • ${networkQuality.downlink} Mbps`;
    }
    return networkQuality.effectiveType?.toUpperCase() || "Connected";
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const introMarkerStart = getMarkerPosition(introStartTime || -1);
  const introMarkerEnd = getMarkerPosition(introEndTime || -1);
  const recapMarkerStart = getMarkerPosition(recapStartTime || -1);
  const recapMarkerEnd = getMarkerPosition(recapEndTime || -1);

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleTap}
      onTouchEnd={handleTap}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={getVideoSource()}
        className="w-full h-full object-contain"
        playsInline
        muted={isMuted}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        onError={handleError}
        onContextMenu={(e) => e.preventDefault()}
        poster={thumbnail || content.thumbnailUrl}
      />

      {/* Error Overlay */}
      <AnimatePresence>
        {mediaError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/90 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-4 text-center px-8">
              {mediaError.code === 2 ? (
                <WifiOff className="h-16 w-16 text-destructive" />
              ) : (
                <AlertCircle className="h-16 w-16 text-destructive" />
              )}
              <h3 className="text-white text-xl font-semibold">Playback Error</h3>
              <p className="text-muted-foreground">{mediaError.message}</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetry();
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium"
                >
                  <RefreshCw className="h-5 w-5" />
                  Try Again
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBack();
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-full font-medium"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Go Back
                </button>
              </div>
              {retryCount > 0 && (
                <p className="text-muted-foreground text-sm mt-2">
                  Retry attempt: {retryCount}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffering Indicator */}
      <AnimatePresence>
        {isBuffering && !mediaError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Volume Indicator Animation */}
      <AnimatePresence>
        {showVolumeIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-40"
          >
            <div className="flex flex-col items-center gap-3 bg-black/70 backdrop-blur-sm rounded-2xl px-8 py-6">
              <Volume2 className="h-12 w-12 text-white" />
              <div className="w-32 h-2 bg-white/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${volumeLevel}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-white text-sm font-medium">{volumeLevel}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap to Play Overlay */}
      <AnimatePresence>
        {showTapToPlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/50"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="p-6 rounded-full bg-primary">
                <Play className="h-12 w-12 text-white" fill="white" />
              </div>
              <span className="text-white text-lg font-medium">Tap to Play</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unmute Prompt */}
      <AnimatePresence>
        {showUnmutePrompt && isMuted && isPlaying && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
          >
            <VolumeX className="h-5 w-5 text-white" />
            <span className="text-white text-sm font-medium">Tap to Unmute</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Double Tap Skip Indicator */}
      <AnimatePresence>
        {skipAmount && (
          <motion.div
            key={`${skipAmount.side}-${Date.now()}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1",
              skipAmount.side === "left" ? "left-16" : "right-16"
            )}
          >
            <div className="p-4 rounded-full bg-white/20 backdrop-blur-sm">
              {skipAmount.side === "left" ? (
                <RotateCcw className="h-8 w-8 text-white" />
              ) : (
                <FastForward className="h-8 w-8 text-white" />
              )}
            </div>
            <span className="text-white text-sm font-medium">
              {skipAmount.side === "left" ? "-" : "+"}{skipAmount.amount}s
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume Prompt */}
      <AnimatePresence>
        {showResumePrompt && savedProgress && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-32 left-4 right-4 bg-card/95 backdrop-blur-lg rounded-xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-foreground font-medium mb-3">Continue watching?</p>
            <p className="text-muted-foreground text-sm mb-4">
              Resume from {formatTime(savedProgress)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleStartOver}
                className="flex-1 py-2 px-4 bg-secondary text-foreground rounded-lg font-medium"
              >
                Start Over
              </button>
              <button
                onClick={handleResume}
                className="flex-1 py-2 px-4 bg-primary text-white rounded-lg font-medium"
              >
                Resume
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip Intro Button */}
      <AnimatePresence>
        {showSkipIntro && (
          <motion.button
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute bottom-32 right-4 px-6 py-3 bg-white/90 text-black rounded-md font-semibold shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              skipIntro();
            }}
          >
            Skip Intro
          </motion.button>
        )}
      </AnimatePresence>

      {/* Skip Recap Button */}
      <AnimatePresence>
        {recapStartTime && recapEndTime && currentTime >= recapStartTime && currentTime < recapEndTime && (
          <motion.button
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute bottom-32 left-4 px-6 py-3 bg-purple-500/90 text-white rounded-md font-semibold shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              skipRecap();
            }}
          >
            Skip Recap
          </motion.button>
        )}
      </AnimatePresence>

      {/* Next Episode Prompt */}
      <AnimatePresence>
        {showNextEpisode && hasNextEpisode && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute bottom-32 right-4 bg-card/95 backdrop-blur-lg rounded-xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-foreground text-sm mb-2">Next episode in</p>
            <p className="text-3xl font-bold text-primary mb-3">{nextEpisodeCountdown}s</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNextEpisode(false)}
                className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => onNextEpisode?.()}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
              >
                Play Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls Overlay */}
      <AnimatePresence>
        {showControls && !showTapToPlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 safe-area-inset-top">
              <button
                onClick={handleBack}
                className="p-2 rounded-full bg-black/30 backdrop-blur-sm"
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
              
              <div className="flex-1 text-center px-4">
                <h2 className="text-white font-semibold truncate">{title}</h2>
                {episodeTitle && (
                  <p className="text-white/70 text-sm truncate">{episodeTitle}</p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {pip.isSupported && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePiP();
                    }}
                    className={cn(
                      "p-2 rounded-full backdrop-blur-sm",
                      pip.isActive ? "bg-primary" : "bg-black/30"
                    )}
                  >
                    <PictureInPicture2 className="h-5 w-5 text-white" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCastVideo();
                  }}
                  className={cn(
                    "p-2 rounded-full backdrop-blur-sm",
                    cast.isConnected ? "bg-primary" : "bg-black/30"
                  )}
                >
                  <Cast className="h-5 w-5 text-white" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings(true);
                  }}
                  className="p-2 rounded-full bg-black/30 backdrop-blur-sm"
                >
                  <Settings className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Center Controls */}
            <div className="absolute inset-0 flex items-center justify-center gap-8">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  skip(-10);
                }}
                className="p-3 rounded-full bg-black/30 backdrop-blur-sm"
              >
                <SkipBack className="h-8 w-8 text-white" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="p-5 rounded-full bg-white/20 backdrop-blur-md"
              >
                {isPlaying ? (
                  <Pause className="h-10 w-10 text-white" fill="white" />
                ) : (
                  <Play className="h-10 w-10 text-white" fill="white" />
                )}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  skip(10);
                }}
                className="p-3 rounded-full bg-black/30 backdrop-blur-sm"
              >
                <SkipForward className="h-8 w-8 text-white" />
              </button>
            </div>

            {/* Bottom Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 safe-area-inset-bottom">
              {/* Progress Bar with Markers */}
              <div className="relative w-full h-1 bg-white/30 rounded-full mb-4">
                {/* Intro Marker (blue) */}
                {introMarkerStart >= 0 && introMarkerEnd >= 0 && (
                  <div
                    className="absolute h-full bg-blue-500/60 rounded-full"
                    style={{
                      left: `${introMarkerStart}%`,
                      width: `${introMarkerEnd - introMarkerStart}%`,
                    }}
                  />
                )}
                {/* Recap Marker (purple) */}
                {recapMarkerStart >= 0 && recapMarkerEnd >= 0 && (
                  <div
                    className="absolute h-full bg-purple-500/60 rounded-full"
                    style={{
                      left: `${recapMarkerStart}%`,
                      width: `${recapMarkerEnd - recapMarkerStart}%`,
                    }}
                  />
                )}
                {/* Buffered */}
                <div
                  className="absolute h-full bg-white/50 rounded-full"
                  style={{ width: `${bufferedProgress}%` }}
                />
                {/* Progress */}
                <div
                  className="absolute h-full bg-primary rounded-full"
                  style={{ width: `${progress}%` }}
                />
                {/* Scrubber */}
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Time and Controls */}
              <div className="flex items-center justify-between">
                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className="p-2"
                  >
                    {isMuted ? (
                      <VolumeX className="h-5 w-5 text-white" />
                    ) : (
                      <Volume2 className="h-5 w-5 text-white" />
                    )}
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    className="p-2"
                  >
                    {isFullscreen ? (
                      <Minimize className="h-5 w-5 text-white" />
                    ) : (
                      <Maximize className="h-5 w-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Sheet - Enhanced with tabs */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-end z-50"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full bg-card rounded-t-3xl p-6 pb-safe max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-6" />
              
              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setSettingsTab("speed")}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg font-medium transition-colors",
                    settingsTab === "speed"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  )}
                >
                  Speed
                </button>
                <button
                  onClick={() => setSettingsTab("quality")}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg font-medium transition-colors",
                    settingsTab === "quality"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  )}
                >
                  Quality
                </button>
              </div>

              {/* Speed Tab */}
              {settingsTab === "speed" && (
                <div>
                  <h3 className="text-lg font-bold mb-4">Playback Speed</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {SPEED_OPTIONS.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => changePlaybackSpeed(speed)}
                        className={cn(
                          "py-3 rounded-lg font-medium transition-colors",
                          playbackSpeed === speed
                            ? "bg-primary text-white"
                            : "bg-secondary text-foreground"
                        )}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quality Tab */}
              {settingsTab === "quality" && (
                <div>
                  <h3 className="text-lg font-bold mb-4">Video Quality</h3>
                  
                  {/* Network Status */}
                  <div className="flex items-center gap-2 mb-4 p-3 bg-secondary/50 rounded-lg">
                    {networkQuality.isOnline ? (
                      <Signal className="h-5 w-5 text-green-500" />
                    ) : (
                      <WifiOff className="h-5 w-5 text-destructive" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {getNetworkStatusText()}
                    </span>
                    {selectedQuality === 'auto' && networkQuality.recommendedQuality && (
                      <span className="ml-auto text-xs text-primary">
                        Recommended: {networkQuality.recommendedQuality}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {QUALITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => changeQuality(option.value)}
                        className={cn(
                          "w-full flex items-center justify-between py-3 px-4 rounded-lg font-medium transition-colors",
                          selectedQuality === option.value
                            ? "bg-primary text-white"
                            : "bg-secondary text-foreground"
                        )}
                      >
                        <span>{option.label}</span>
                        {selectedQuality === option.value && (
                          <Check className="h-5 w-5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cast Sheet */}
      <MobileCastSheet
        open={showCastSheet}
        onClose={() => setShowCastSheet(false)}
        videoUrl={getVideoSource()}
        videoTitle={episodeTitle || title}
        thumbnail={thumbnail || content.thumbnailUrl}
        currentTime={currentTime}
        duration={duration}
        onCastStart={() => {
          videoRef.current?.pause();
          setIsPlaying(false);
        }}
      />
    </motion.div>
  );
}
