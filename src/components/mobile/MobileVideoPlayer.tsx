import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  Maximize, Minimize, ChevronLeft, Settings, Cast, Loader2,
  RotateCcw, FastForward, RefreshCw, AlertCircle, WifiOff,
  PictureInPicture2, Wifi, Signal, Check, Lock, Unlock, Sun, ChevronDown,
  Clock, Save, X, Users
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
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { savePlaybackPosition, getPlaybackPosition } from "@/lib/playbackStorage";
import { useSkipPreferences } from "@/hooks/useSkipPreferences";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useWatchPartyContext } from "@/contexts/WatchPartyContext";

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
  isKidsMode?: boolean;
  kidsProfileId?: string;
  onTimeUpdate?: (watchedMinutes: number) => void;
  kidsTimeRemaining?: number | null;
  kidsTimeLimitReached?: boolean;
  kidsBedtimeReached?: boolean;
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
  isKidsMode = false,
  kidsProfileId,
  onTimeUpdate,
  kidsTimeRemaining,
  kidsTimeLimitReached = false,
  kidsBedtimeReached = false,
}: MobileVideoPlayerProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapSideRef = useRef<"left" | "right" | null>(null);
  const { user } = useAuth();
  
  // Use back navigation hook for proper history handling
  const { goBack } = useBackNavigation({ fallbackPath: '/' });
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
  const [settingsTab, setSettingsTab] = useState<"speed" | "quality" | "intro" | "recap" | "skip">("speed");
  
  // Intro skip setter states (for admins)
  const [localIntroStart, setLocalIntroStart] = useState<number>(introStartTime ?? 0);
  const [localIntroEnd, setLocalIntroEnd] = useState<number>(introEndTime ?? 90);
  const [isSavingIntro, setIsSavingIntro] = useState(false);
  
  // Recap skip setter states (for admins)
  const [localRecapStart, setLocalRecapStart] = useState<number>(recapStartTime ?? 0);
  const [localRecapEnd, setLocalRecapEnd] = useState<number>(recapEndTime ?? 0);
  const [isSavingRecap, setIsSavingRecap] = useState(false);
  
  // Lock controls state
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockHint, setShowUnlockHint] = useState(false);
  
  // Gesture states
  const [brightness, setBrightness] = useState(100);
  const [showBrightnessIndicator, setShowBrightnessIndicator] = useState(false);
  const [showGestureVolumeIndicator, setShowGestureVolumeIndicator] = useState(false);
  const gestureStartRef = useRef<{ x: number; y: number; side: 'left' | 'right' | null; startValue: number } | null>(null);
  const isGesturingRef = useRef(false);
  
  // Swipe down to close state
  const [swipeY, setSwipeY] = useState(0);
  const [isSwipingDown, setIsSwipingDown] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  
  // Swipe right to go back state
  const [swipeX, setSwipeX] = useState(0);
  const [isSwipingRight, setIsSwipingRight] = useState(false);

  // Store loaded progress for later use when duration is available
  const loadedProgressRef = useRef<number | null>(null);
  const resumePromptShownRef = useRef(false);
  
  // Hooks
  const { saveProgressImmediately } = useWatchProgress({
    contentId: content.id,
    onProgressLoaded: (progress) => {
      // Store the progress for when duration becomes available
      loadedProgressRef.current = progress;
    },
  });
  
  // Load progress from IndexedDB on mount (for offline continuity)
  useEffect(() => {
    const loadOfflineProgress = async () => {
      try {
        const position = await getPlaybackPosition(content.id, episodeId);
        if (position && position.position > 0) {
          // Only use IndexedDB position if we don't have a server position
          if (!loadedProgressRef.current) {
            loadedProgressRef.current = position.position;
          }
        }
      } catch (error) {
        console.error('[MobileVideoPlayer] Failed to load offline progress:', error);
      }
    };
    
    loadOfflineProgress();
  }, [content.id, episodeId]);
  
  // Show resume prompt only once when both progress and duration are available
  useEffect(() => {
    if (
      loadedProgressRef.current && 
      loadedProgressRef.current > 0 && 
      duration > 0 && 
      !resumePromptShownRef.current
    ) {
      const progressRatio = loadedProgressRef.current / duration;
      if (progressRatio > 0.01 && progressRatio < 0.95) {
        setSavedProgress(loadedProgressRef.current);
        setShowResumePrompt(true);
        resumePromptShownRef.current = true;
      }
    }
  }, [duration]);
  const cast = useCast();
  const networkQuality = useNetworkQuality();
  const pip = usePictureInPicture(videoRef);
  const castHistory = useCastHistory();
  const { data: isAdmin } = useIsAdmin();
  const skipPrefs = useSkipPreferences();
  const autoSkippedIntroRef = useRef(false);
  const autoSkippedRecapRef = useRef(false);
  
  // Watch Party sync
  const { party, isHost, isWatchPartyGuest, isSyncing, updatePlayback, syncToParty } = useWatchPartyContext();
  const lastPartySyncRef = useRef<number>(0);
  const initialPartySyncDoneRef = useRef<boolean>(false);

  // Save intro times to database (for admins)
  const handleSaveIntroTimes = useCallback(async () => {
    if (!episodeId || !isAdmin) {
      toast.error("Cannot save intro times");
      return;
    }
    
    setIsSavingIntro(true);
    try {
      const { error } = await supabase
        .from("episodes")
        .update({
          intro_start_time: localIntroStart,
          intro_end_time: localIntroEnd,
        })
        .eq("id", episodeId);
      
      if (error) throw error;
      toast.success("Intro times saved successfully");
    } catch (error) {
      console.error("[MobileVideoPlayer] Failed to save intro times:", error);
      toast.error("Failed to save intro times");
    } finally {
      setIsSavingIntro(false);
    }
  }, [episodeId, isAdmin, localIntroStart, localIntroEnd]);

  // Save recap times to database (for admins)
  const handleSaveRecapTimes = useCallback(async () => {
    if (!episodeId || !isAdmin) {
      toast.error("Cannot save recap times");
      return;
    }
    
    setIsSavingRecap(true);
    try {
      const { error } = await supabase
        .from("episodes")
        .update({
          recap_start_time: localRecapStart,
          recap_end_time: localRecapEnd,
        })
        .eq("id", episodeId);
      
      if (error) throw error;
      toast.success("Recap times saved successfully");
    } catch (error) {
      console.error("[MobileVideoPlayer] Failed to save recap times:", error);
      toast.error("Failed to save recap times");
    } finally {
      setIsSavingRecap(false);
    }
  }, [episodeId, isAdmin, localRecapStart, localRecapEnd]);

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
  // Handle intro skip (auto or manual)
  useEffect(() => {
    // Determine effective intro times (use default if no specific times and default is set)
    const effectiveIntroStart = introStartTime ?? 0;
    const effectiveIntroEnd = (introEndTime && introEndTime > 0) ? introEndTime : (skipPrefs.defaultIntroDuration > 0 ? skipPrefs.defaultIntroDuration : 0);
    const hasIntroSegment = effectiveIntroEnd > effectiveIntroStart;
    
    if (hasIntroSegment) {
      const isInIntro = currentTime >= effectiveIntroStart && currentTime < effectiveIntroEnd;
      
      // Auto-skip if preference is enabled
      if (skipPrefs.autoSkipIntro && isInIntro && !autoSkippedIntroRef.current) {
        autoSkippedIntroRef.current = true;
        const video = videoRef.current;
        if (video) {
          video.currentTime = effectiveIntroEnd;
          setCurrentTime(effectiveIntroEnd);
        }
        setShowSkipIntro(false);
        toast.info('Intro skipped automatically', { duration: 2000 });
        return;
      }
      
      // Show skip button only if not auto-skipping
      if (!skipPrefs.autoSkipIntro) {
        setShowSkipIntro(isInIntro);
      } else {
        setShowSkipIntro(false);
      }
      
      // Reset auto-skip flag when outside intro
      if (!isInIntro) {
        autoSkippedIntroRef.current = false;
      }
    }
  }, [currentTime, introStartTime, introEndTime, skipPrefs.autoSkipIntro, skipPrefs.defaultIntroDuration]);
  
  // Handle recap skip (auto or manual)
  useEffect(() => {
    if (recapStartTime && recapEndTime) {
      const isInRecap = currentTime >= recapStartTime && currentTime < recapEndTime;
      
      // Auto-skip if preference is enabled
      if (skipPrefs.autoSkipRecap && isInRecap && !autoSkippedRecapRef.current) {
        autoSkippedRecapRef.current = true;
        const video = videoRef.current;
        if (video) {
          video.currentTime = recapEndTime;
          setCurrentTime(recapEndTime);
        }
        toast.info('Recap skipped automatically', { duration: 2000 });
        return;
      }
      
      // Reset auto-skip flag when outside recap
      if (!isInRecap) {
        autoSkippedRecapRef.current = false;
      }
    }
  }, [currentTime, recapStartTime, recapEndTime, skipPrefs.autoSkipRecap]);

  // Auto-pause when kids time limit or bedtime is reached
  useEffect(() => {
    if (isKidsMode && (kidsTimeLimitReached || kidsBedtimeReached) && isPlaying) {
      const video = videoRef.current;
      if (video) {
        video.pause();
        setIsPlaying(false);
      }
    }
  }, [isKidsMode, kidsTimeLimitReached, kidsBedtimeReached, isPlaying]);

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

  // Save progress periodically (both to server and IndexedDB)
  // Also track kids viewing time if in kids mode
  useEffect(() => {
    if (!isPlaying || !duration) return;

    let lastReportedMinute = Math.floor(currentTime / 60);

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && duration > 0) {
        // Save to server
        saveProgressImmediately(video.currentTime, duration);
        
        // Also save to IndexedDB for offline continuity
        savePlaybackPosition(content.id, video.currentTime, duration, {
          episodeId,
          title: episodeTitle || title,
          thumbnail: thumbnail || content.thumbnailUrl,
        }).catch(console.error);

        // Track kids viewing time - report every minute watched
        if (isKidsMode && onTimeUpdate) {
          const currentMinute = Math.floor(video.currentTime / 60);
          if (currentMinute > lastReportedMinute) {
            const minutesWatched = currentMinute - lastReportedMinute;
            onTimeUpdate(minutesWatched);
            lastReportedMinute = currentMinute;
          }
        }
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [isPlaying, duration, saveProgressImmediately, content.id, episodeId, episodeTitle, title, thumbnail, content.thumbnailUrl, isKidsMode, onTimeUpdate, currentTime]);

  // Watch Party sync - sync video to party state for non-hosts
  // Force sync on initial join, then use tighter threshold
  useEffect(() => {
    if (!party || isHost) return;
    const video = videoRef.current;
    if (!video) return;
    
    // Force sync on first update (initial join)
    const forceSync = !initialPartySyncDoneRef.current;
    syncToParty(video, forceSync);
    initialPartySyncDoneRef.current = true;
  }, [party?.playback_time, party?.is_playing, isHost, syncToParty]);

  // Watch Party - periodic sync for guests to catch drift
  useEffect(() => {
    if (!party || isHost) return;
    
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video) {
        syncToParty(video, false);
      }
    }, 5000); // Sync every 5 seconds
    
    return () => clearInterval(interval);
  }, [party, isHost, syncToParty]);

  // Watch Party - listen for start_playback broadcast from host
  useEffect(() => {
    if (!party || isHost) return;
    
    const channel = supabase
      .channel(`watch-party-reactions-${party.id}`)
      .on('broadcast', { event: 'start_playback' }, (payload) => {
        console.log('[MobileVideoPlayer] Received start_playback broadcast:', payload);
        const video = videoRef.current;
        if (video) {
          // Force sync to start position and begin playback
          video.currentTime = 0;
          video.play().catch(console.error);
          toast.success("🎬 Playback started!", { duration: 3000 });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [party?.id, isHost]);

  // Watch Party - host sends playback updates
  useEffect(() => {
    if (!party || !isHost) return;
    const video = videoRef.current;
    if (!video) return;

    const handleHostPlayPause = () => {
      updatePlayback(video.currentTime, !video.paused);
    };
    
    // Send periodic updates during playback for better sync
    const handleHostTimeUpdate = () => {
      const now = Date.now();
      if (now - lastPartySyncRef.current >= 2000) { // Every 2 seconds
        lastPartySyncRef.current = now;
        updatePlayback(video.currentTime, !video.paused);
      }
    };

    video.addEventListener('play', handleHostPlayPause);
    video.addEventListener('pause', handleHostPlayPause);
    video.addEventListener('seeked', handleHostPlayPause);
    video.addEventListener('timeupdate', handleHostTimeUpdate);

    return () => {
      video.removeEventListener('play', handleHostPlayPause);
      video.removeEventListener('pause', handleHostPlayPause);
      video.removeEventListener('seeked', handleHostPlayPause);
      video.removeEventListener('timeupdate', handleHostTimeUpdate);
    };
  }, [party, isHost, updatePlayback]);

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
    // If locked, show unlock hint instead
    if (isLocked) {
      setShowUnlockHint(true);
      setTimeout(() => setShowUnlockHint(false), 2000);
      return;
    }
    
    // Ignore if gesturing
    if (isGesturingRef.current) return;
    
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
  }, [skip, resetControlsTimeout, isLocked]);

  // Gesture handlers for brightness/volume
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isLocked) return;
    
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const relativeX = x / rect.width;
    
    // Only start gesture if touch is on the sides (left 30% or right 30%)
    if (relativeX < 0.3) {
      gestureStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        side: 'left',
        startValue: brightness
      };
    } else if (relativeX > 0.7) {
      gestureStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        side: 'right',
        startValue: volumeLevel
      };
    } else {
      gestureStartRef.current = null;
    }
  }, [isLocked, brightness, volumeLevel]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!gestureStartRef.current || isLocked) return;
    
    const touch = e.touches[0];
    const deltaY = gestureStartRef.current.y - touch.clientY;
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const sensitivity = 200; // pixels for full range
    const deltaPercent = (deltaY / sensitivity) * 100;
    
    // Only mark as gesturing if moved more than 10px
    if (Math.abs(deltaY) > 10) {
      isGesturingRef.current = true;
    }
    
    if (gestureStartRef.current.side === 'left') {
      // Brightness control (left side)
      const newBrightness = Math.max(10, Math.min(100, gestureStartRef.current.startValue + deltaPercent));
      setBrightness(Math.round(newBrightness));
      setShowBrightnessIndicator(true);
    } else if (gestureStartRef.current.side === 'right') {
      // Volume control (right side)
      const newVolume = Math.max(0, Math.min(100, gestureStartRef.current.startValue + deltaPercent));
      setVolumeLevel(Math.round(newVolume));
      
      const video = videoRef.current;
      if (video) {
        video.volume = newVolume / 100;
        video.muted = newVolume === 0;
        setIsMuted(newVolume === 0);
      }
      setShowGestureVolumeIndicator(true);
    }
  }, [isLocked]);

  const handleTouchEnd = useCallback(() => {
    if (gestureStartRef.current) {
      // Hide indicators after a delay
      setTimeout(() => {
        setShowBrightnessIndicator(false);
        setShowGestureVolumeIndicator(false);
      }, 500);
    }
    
    gestureStartRef.current = null;
    
    // Reset gesturing flag after a small delay to not interfere with tap
    setTimeout(() => {
      isGesturingRef.current = false;
    }, 100);
  }, []);

  // Toggle lock
  const toggleLock = useCallback(() => {
    setIsLocked(prev => {
      if (!prev) {
        toast.info("Controls locked");
        setShowControls(false);
      } else {
        toast.info("Controls unlocked");
        setShowControls(true);
        resetControlsTimeout();
      }
      return !prev;
    });
  }, [resetControlsTimeout]);

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
    // Save progress before closing (both to server and IndexedDB for offline)
    const video = videoRef.current;
    if (video && duration > 0) {
      saveProgressImmediately(video.currentTime, duration);
      
      // Also save to IndexedDB for offline continuity
      savePlaybackPosition(content.id, video.currentTime, duration, {
        episodeId,
        title: episodeTitle || title,
        thumbnail: thumbnail || content.thumbnailUrl,
      }).catch(console.error);
    }
    
    // Call onClose to update parent state
    onClose();
    
    // Navigate back to previous page
    goBack();
  }, [duration, saveProgressImmediately, onClose, content.id, episodeId, episodeTitle, title, thumbnail, content.thumbnailUrl, goBack]);

  // Swipe gesture handlers (down to minimize, right to go back)
  const handleSwipePan = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isLocked) return;
    
    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);
    
    // Respond to downward swipes
    if (info.offset.y > 0 && absY > absX) {
      setSwipeY(info.offset.y);
      setIsSwipingDown(true);
      setSwipeX(0);
      setIsSwipingRight(false);
    }
    // Respond to rightward swipes (left-to-right)
    else if (info.offset.x > 0 && absX > absY) {
      setSwipeX(info.offset.x);
      setIsSwipingRight(true);
      setSwipeY(0);
      setIsSwipingDown(false);
    }
  }, [isLocked]);

  const handleSwipePanEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isLocked) {
      setSwipeY(0);
      setIsSwipingDown(false);
      setSwipeX(0);
      setIsSwipingRight(false);
      return;
    }
    
    // Close if swiped down more than 150px with enough velocity
    if (info.offset.y > 150 || (info.offset.y > 80 && info.velocity.y > 500)) {
      handleBack();
    }
    
    // Navigate to homepage if swiped right more than 150px with enough velocity
    if (info.offset.x > 150 || (info.offset.x > 80 && info.velocity.x > 500)) {
      handleBack();
      navigate('/');
    }
    
    // Reset positions
    setSwipeY(0);
    setIsSwipingDown(false);
    setSwipeX(0);
    setIsSwipingRight(false);
  }, [isLocked, handleBack, navigate]);

  // Show swipe hint on first open
  useEffect(() => {
    const hasSeenHint = localStorage.getItem('mobile_player_swipe_hint');
    if (!hasSeenHint) {
      setTimeout(() => {
        setShowSwipeHint(true);
        setTimeout(() => {
          setShowSwipeHint(false);
          localStorage.setItem('mobile_player_swipe_hint', 'true');
        }, 3000);
      }, 2000);
    }
  }, []);

  // Handle Capacitor/browser back button for proper navigation
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupBackHandler = async () => {
      try {
        // Try to use Capacitor App plugin for native back button
        const { App } = await import('@capacitor/app');
        
        const listener = App.addListener('backButton', () => {
          handleBack();
        });

        cleanup = () => {
          listener.then(l => l.remove());
        };
      } catch (e) {
        // Capacitor not available - handle browser back with popstate
        const handlePopstate = (event: PopStateEvent) => {
          // Prevent default navigation and close the player instead
          event.preventDefault();
          handleBack();
          // Push state back to prevent actual navigation
          window.history.pushState(null, '', window.location.href);
        };
        
        // Push a state so we can intercept back button
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopstate);
        
        cleanup = () => {
          window.removeEventListener('popstate', handlePopstate);
        };
      }
    };

    setupBackHandler();

    return () => {
      cleanup?.();
    };
  }, [handleBack]);

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

  // Calculate swipe opacity for fade effect
  const swipeOpacity = isSwipingDown ? Math.max(0.3, 1 - swipeY / 300) : 1;

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-black"
      style={{ 
        filter: `brightness(${brightness}%)`,
        y: swipeY,
        opacity: swipeOpacity,
      }}
      initial={{ opacity: 0, x: 0, y: 0 }}
      animate={{ 
        opacity: swipeOpacity, 
        y: isSwipingDown ? swipeY : 0,
        x: isSwipingRight ? swipeX * 0.3 : 0 
      }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      drag
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={{ top: 0, bottom: 0.5, left: 0, right: 0.5 }}
      onDrag={handleSwipePan}
      onDragEnd={handleSwipePanEnd}
      onClick={handleTap}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe Down Hint */}
      <AnimatePresence>
        {showSwipeHint && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none"
          >
            <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
              <ChevronDown className="h-5 w-5 text-white animate-bounce" />
              <span className="text-white text-sm font-medium">Swipe down to close</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe indicator while swiping */}
      <AnimatePresence>
        {isSwipingDown && swipeY > 50 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className={cn(
              "rounded-full p-3 transition-colors",
              swipeY > 150 ? "bg-primary" : "bg-white/20 backdrop-blur-sm"
            )}>
              <ChevronDown className={cn(
                "h-6 w-6 transition-colors",
                swipeY > 150 ? "text-white" : "text-white/70"
              )} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swipe Right indicator while swiping */}
      <AnimatePresence>
        {isSwipingRight && swipeX > 50 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
          >
            <div className={cn(
              "rounded-full p-3 transition-colors",
              swipeX > 150 ? "bg-primary" : "bg-white/20 backdrop-blur-sm"
            )}>
              <ChevronLeft className={cn(
                "h-6 w-6 transition-colors",
                swipeX > 150 ? "text-white" : "text-white/70"
              )} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Brightness Gesture Indicator (left side) */}
      <AnimatePresence>
        {showBrightnessIndicator && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-40"
          >
            <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-4 py-6 flex flex-col items-center gap-3">
              <Sun className="h-8 w-8 text-yellow-400" />
              <div className="w-2 h-32 bg-white/30 rounded-full overflow-hidden rotate-180">
                <motion.div
                  className="w-full bg-yellow-400 rounded-full"
                  style={{ height: `${brightness}%` }}
                />
              </div>
              <span className="text-white text-sm font-medium">{brightness}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Volume Gesture Indicator (right side) */}
      <AnimatePresence>
        {showGestureVolumeIndicator && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-40"
          >
            <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-4 py-6 flex flex-col items-center gap-3">
              {volumeLevel === 0 ? (
                <VolumeX className="h-8 w-8 text-white" />
              ) : (
                <Volume2 className="h-8 w-8 text-white" />
              )}
              <div className="w-2 h-32 bg-white/30 rounded-full overflow-hidden rotate-180">
                <motion.div
                  className="w-full bg-white rounded-full"
                  style={{ height: `${volumeLevel}%` }}
                />
              </div>
              <span className="text-white text-sm font-medium">{volumeLevel}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Locked Screen Overlay */}
      <AnimatePresence>
        {isLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50"
            onClick={(e) => {
              e.stopPropagation();
              setShowUnlockHint(true);
              setTimeout(() => setShowUnlockHint(false), 2000);
            }}
          >
            {/* Unlock button (always visible when locked) */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: showUnlockHint ? 1 : 0.5 }}
              className="absolute top-4 right-4 p-3 rounded-full bg-black/50 backdrop-blur-sm safe-area-inset-top"
              onClick={(e) => {
                e.stopPropagation();
                toggleLock();
              }}
            >
              <Unlock className="h-6 w-6 text-white" />
            </motion.button>

            {/* Unlock hint */}
            <AnimatePresence>
              {showUnlockHint && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-6 py-4 flex items-center gap-3">
                    <Lock className="h-6 w-6 text-white" />
                    <span className="text-white font-medium">Tap unlock button to unlock</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap to Play Overlay */}
      <AnimatePresence>
        {showTapToPlay && !isLocked && (
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

      {/* Kids Time Warning Overlay - Shows when 5 or less minutes remain */}
      <AnimatePresence>
        {isKidsMode && kidsTimeRemaining !== null && kidsTimeRemaining <= 5 && kidsTimeRemaining > 0 && !kidsTimeLimitReached && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-4 right-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">Time is running low!</p>
                <p className="text-white/80 text-sm">
                  Only {kidsTimeRemaining} minute{kidsTimeRemaining !== 1 ? 's' : ''} left today
                </p>
              </div>
              <div className="text-3xl">⏰</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kids Time's Up Screen - Full screen overlay when limit reached */}
      <AnimatePresence>
        {isKidsMode && kidsTimeLimitReached && !kidsBedtimeReached && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="text-center px-8"
            >
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className="text-8xl mb-6"
              >
                🌙
              </motion.div>
              <h1 className="text-4xl font-bold text-white mb-4">Time's Up!</h1>
              <p className="text-white/90 text-lg mb-2">
                Great job watching today!
              </p>
              <p className="text-white/70 text-base mb-8">
                Come back tomorrow for more fun adventures! 🌟
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-8 py-4 bg-white text-purple-600 rounded-2xl font-bold text-lg shadow-xl"
              >
                See You Tomorrow!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kids Bedtime Screen - Full screen overlay when bedtime reached */}
      <AnimatePresence>
        {isKidsMode && kidsBedtimeReached && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-slate-800 via-indigo-900 to-purple-900 flex flex-col items-center justify-center z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="text-center px-8"
            >
              {/* Stars animation */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ 
                      duration: 2 + Math.random() * 2, 
                      repeat: Infinity, 
                      delay: Math.random() * 2 
                    }}
                    className="absolute text-yellow-200"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      fontSize: `${8 + Math.random() * 16}px`,
                    }}
                  >
                    ✦
                  </motion.div>
                ))}
              </div>
              
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [-5, 5, -5]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="text-8xl mb-6"
              >
                😴
              </motion.div>
              <h1 className="text-4xl font-bold text-white mb-4">Bedtime!</h1>
              <p className="text-white/90 text-lg mb-2">
                It's time to rest now 💤
              </p>
              <p className="text-white/70 text-base mb-8">
                Sweet dreams! See you tomorrow for more adventures! ⭐
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-bold text-lg shadow-xl"
              >
                Goodnight!
              </motion.button>
            </motion.div>
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
            {/* Top Bar - Only back button and title */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-safe">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleBack();
                }}
                className="p-3 rounded-full bg-black/50 backdrop-blur-sm active:bg-black/70 touch-manipulation cursor-pointer"
                style={{ minWidth: 48, minHeight: 48, WebkitTapHighlightColor: 'transparent' }}
                type="button"
              >
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
              
              <div className="flex-1 text-center px-4">
                <h2 className="text-white font-semibold truncate">{title}</h2>
                {episodeTitle && (
                  <p className="text-white/70 text-sm truncate">{episodeTitle}</p>
                )}
              </div>
              
              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleBack();
                }}
                className="p-3 rounded-full bg-black/50 backdrop-blur-sm active:bg-black/70 touch-manipulation cursor-pointer"
                style={{ minWidth: 48, minHeight: 48, WebkitTapHighlightColor: 'transparent' }}
                type="button"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* Watch Party Guest Indicator */}
            {isWatchPartyGuest && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30">
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm transition-colors",
                  isSyncing ? "bg-amber-500/80" : "bg-primary/80"
                )}>
                  <Users className="h-4 w-4 text-white" />
                  <span className="text-white text-sm font-medium">
                    {isSyncing ? "Syncing..." : "Host controls playback"}
                  </span>
                </div>
              </div>
            )}

            {/* Center Controls */}
            <div className="absolute inset-0 flex items-center justify-center gap-8">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isWatchPartyGuest) skip(-10);
                }}
                disabled={isWatchPartyGuest}
                className={cn(
                  "p-3 rounded-full bg-black/30 backdrop-blur-sm",
                  isWatchPartyGuest && "opacity-40 cursor-not-allowed"
                )}
              >
                <SkipBack className="h-8 w-8 text-white" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isWatchPartyGuest) togglePlay();
                }}
                disabled={isWatchPartyGuest}
                className={cn(
                  "p-5 rounded-full bg-white/20 backdrop-blur-md",
                  isWatchPartyGuest && "opacity-40 cursor-not-allowed"
                )}
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
                  if (!isWatchPartyGuest) skip(10);
                }}
                disabled={isWatchPartyGuest}
                className={cn(
                  "p-3 rounded-full bg-black/30 backdrop-blur-sm",
                  isWatchPartyGuest && "opacity-40 cursor-not-allowed"
                )}
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
                {/* Scrubber - disabled for watch party guests */}
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={isWatchPartyGuest ? undefined : handleSeek}
                  disabled={isWatchPartyGuest}
                  className={cn(
                    "absolute inset-0 w-full opacity-0",
                    isWatchPartyGuest ? "cursor-not-allowed" : "cursor-pointer"
                  )}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Time and Controls */}
              <div className="flex items-center justify-between">
                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                
                <div className="flex items-center gap-1">
                  {/* Volume */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className="p-3 rounded-full active:bg-white/20 touch-manipulation"
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    {isMuted ? (
                      <VolumeX className="h-5 w-5 text-white" />
                    ) : (
                      <Volume2 className="h-5 w-5 text-white" />
                    )}
                  </button>
                  
                  {/* PiP - hidden in kids mode */}
                  {!isKidsMode && pip.isSupported && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePiP();
                      }}
                      className={cn(
                        "p-3 rounded-full active:bg-white/20 touch-manipulation",
                        pip.isActive ? "bg-primary" : ""
                      )}
                      style={{ minWidth: 44, minHeight: 44 }}
                    >
                      <PictureInPicture2 className="h-5 w-5 text-white" />
                    </button>
                  )}
                  
                  {/* Cast - hidden in kids mode */}
                  {!isKidsMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCastVideo();
                      }}
                      className={cn(
                        "p-3 rounded-full active:bg-white/20 touch-manipulation",
                        cast.isConnected ? "bg-primary" : ""
                      )}
                      style={{ minWidth: 44, minHeight: 44 }}
                    >
                      <Cast className="h-5 w-5 text-white" />
                    </button>
                  )}
                  
                  {/* Settings - simplified in kids mode but still available for skip settings */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettings(true);
                    }}
                    className="p-3 rounded-full active:bg-white/20 touch-manipulation"
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Settings className="h-5 w-5 text-white" />
                  </button>
                  
                  {/* Watch Party - hidden in kids mode */}
                  {!isKidsMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent('toggleWatchParty', {
                          detail: {
                            contentId: content.id,
                            episodeId,
                            contentTitle: episodeTitle || title
                          }
                        }));
                      }}
                      className={cn(
                        "p-3 rounded-full active:bg-white/20 touch-manipulation",
                        party && "bg-primary"
                      )}
                      style={{ minWidth: 44, minHeight: 44 }}
                    >
                      <Users className="h-5 w-5 text-white" />
                    </button>
                  )}
                  
                  {/* Lock - hidden in kids mode */}
                  {!isKidsMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLock();
                      }}
                      className="p-3 rounded-full active:bg-white/20 touch-manipulation"
                      style={{ minWidth: 44, minHeight: 44 }}
                    >
                      <Lock className="h-5 w-5 text-white" />
                    </button>
                  )}
                  
                  {/* Fullscreen */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    className="p-3 rounded-full active:bg-white/20 touch-manipulation"
                    style={{ minWidth: 44, minHeight: 44 }}
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
              
              {/* Tabs - Simplified for kids mode */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {!isKidsMode && (
                  <>
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
                  </>
                )}
                <button
                  onClick={() => setSettingsTab("skip")}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg font-medium transition-colors",
                    settingsTab === "skip"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  )}
                >
                  Skip
                </button>
                {!isKidsMode && isAdmin && episodeId && (
                  <>
                    <button
                      onClick={() => setSettingsTab("intro")}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-lg font-medium transition-colors",
                        settingsTab === "intro"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                      )}
                    >
                      Intro
                    </button>
                    <button
                      onClick={() => setSettingsTab("recap")}
                      className={cn(
                        "flex-1 py-2 px-4 rounded-lg font-medium transition-colors",
                        settingsTab === "recap"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                      )}
                    >
                      Recap
                    </button>
                  </>
                )}
              </div>

              {/* Speed Tab - Hidden in kids mode */}
              {settingsTab === "speed" && !isKidsMode && (
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

              {/* Quality Tab - Hidden in kids mode */}
              {settingsTab === "quality" && !isKidsMode && (
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

              {/* Skip Preferences Tab */}
              {settingsTab === "skip" && (
                <div>
                  <h3 className="text-lg font-bold mb-4">Auto-Skip Preferences</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Automatically skip intros and recaps when available.
                  </p>
                  
                  <div className="space-y-3">
                    <button
                      onClick={() => skipPrefs.toggleAutoSkipIntro()}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-4 rounded-lg font-medium transition-colors",
                        skipPrefs.autoSkipIntro
                          ? "bg-primary text-white"
                          : "bg-secondary text-foreground"
                      )}
                    >
                      <span>Auto-skip intros</span>
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        skipPrefs.autoSkipIntro ? "bg-white border-white" : "border-muted-foreground"
                      )}>
                        {skipPrefs.autoSkipIntro && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    </button>
                    
                    <button
                      onClick={() => skipPrefs.toggleAutoSkipRecap()}
                      className={cn(
                        "w-full flex items-center justify-between py-3 px-4 rounded-lg font-medium transition-colors",
                        skipPrefs.autoSkipRecap
                          ? "bg-primary text-white"
                          : "bg-secondary text-foreground"
                      )}
                    >
                      <span>Auto-skip recaps</span>
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        skipPrefs.autoSkipRecap ? "bg-white border-white" : "border-muted-foreground"
                      )}>
                        {skipPrefs.autoSkipRecap && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    </button>
                    
                    {/* Default Intro Duration */}
                    <div className="mt-4 pt-4 border-t border-border">
                      <label className="text-sm font-medium mb-2 block">Default Intro Duration</label>
                      <p className="text-muted-foreground text-xs mb-3">
                        Used for shows without specific intro times configured.
                      </p>
                      <div className="grid grid-cols-5 gap-2">
                        {[0, 30, 60, 90, 120].map((duration) => (
                          <button
                            key={duration}
                            onClick={() => skipPrefs.setDefaultIntroDuration(duration)}
                            className={cn(
                              "py-2 px-1 rounded-lg text-sm font-medium transition-colors",
                              skipPrefs.defaultIntroDuration === duration
                                ? "bg-primary text-white"
                                : "bg-secondary text-foreground"
                            )}
                          >
                            {duration === 0 ? 'Off' : `${duration}s`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground text-xs mt-4">
                    Your preferences are saved and will apply to all videos.
                  </p>
                </div>
              )}

              {/* Intro Tab (Admin only) */}
              {settingsTab === "intro" && isAdmin && episodeId && (
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Set Intro Skip
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Set the intro start and end times for this episode. The skip button will appear during this segment.
                  </p>
                  
                  {/* Current Time Reference */}
                  <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-muted-foreground mb-1">Current Position</p>
                    <p className="text-xl font-mono font-bold text-primary">{formatTime(currentTime)}</p>
                    <p className="text-xs text-muted-foreground mt-1">({Math.floor(currentTime)} seconds)</p>
                  </div>
                  
                  {/* Intro Start */}
                  <div className="mb-4">
                    <label className="text-sm font-medium mb-2 block">Intro Start (seconds)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={localIntroStart}
                        onChange={(e) => setLocalIntroStart(parseInt(e.target.value) || 0)}
                        min={0}
                        className="flex-1 bg-secondary rounded-lg px-4 py-3 text-foreground font-mono"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocalIntroStart(Math.floor(currentTime));
                          toast.info(`Intro start set to ${formatTime(currentTime)}`);
                        }}
                        className="px-4 py-3 bg-blue-500 text-white rounded-lg font-medium whitespace-nowrap"
                      >
                        Use Current
                      </button>
                    </div>
                  </div>
                  
                  {/* Intro End */}
                  <div className="mb-6">
                    <label className="text-sm font-medium mb-2 block">Intro End (seconds)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={localIntroEnd}
                        onChange={(e) => setLocalIntroEnd(parseInt(e.target.value) || 0)}
                        min={0}
                        className="flex-1 bg-secondary rounded-lg px-4 py-3 text-foreground font-mono"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocalIntroEnd(Math.floor(currentTime));
                          toast.info(`Intro end set to ${formatTime(currentTime)}`);
                        }}
                        className="px-4 py-3 bg-blue-500 text-white rounded-lg font-medium whitespace-nowrap"
                      >
                        Use Current
                      </button>
                    </div>
                  </div>
                  
                  {/* Duration Preview */}
                  {localIntroEnd > localIntroStart && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-400">
                        Intro duration: {formatTime(localIntroEnd - localIntroStart)} ({localIntroEnd - localIntroStart} seconds)
                      </p>
                    </div>
                  )}
                  
                  {/* Save Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveIntroTimes();
                    }}
                    disabled={isSavingIntro || localIntroEnd <= localIntroStart}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors",
                      isSavingIntro || localIntroEnd <= localIntroStart
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-white"
                    )}
                  >
                    {isSavingIntro ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    {isSavingIntro ? "Saving..." : "Save Intro Times"}
                  </button>
                  
                  {localIntroEnd <= localIntroStart && (
                    <p className="text-destructive text-sm mt-2 text-center">
                      Intro end must be greater than intro start
                    </p>
                  )}
                </div>
              )}

              {/* Recap Tab (Admin only) */}
              {settingsTab === "recap" && isAdmin && episodeId && (
                <div>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <RotateCcw className="h-5 w-5" />
                    Set Recap Skip
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Set the recap start and end times for this episode. The skip button will appear during this segment.
                  </p>
                  
                  {/* Current Time Reference */}
                  <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-muted-foreground mb-1">Current Position</p>
                    <p className="text-xl font-mono font-bold text-primary">{formatTime(currentTime)}</p>
                    <p className="text-xs text-muted-foreground mt-1">({Math.floor(currentTime)} seconds)</p>
                  </div>
                  
                  {/* Recap Start */}
                  <div className="mb-4">
                    <label className="text-sm font-medium mb-2 block">Recap Start (seconds)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={localRecapStart}
                        onChange={(e) => setLocalRecapStart(parseInt(e.target.value) || 0)}
                        min={0}
                        className="flex-1 bg-secondary rounded-lg px-4 py-3 text-foreground font-mono"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocalRecapStart(Math.floor(currentTime));
                          toast.info(`Recap start set to ${formatTime(currentTime)}`);
                        }}
                        className="px-4 py-3 bg-purple-500 text-white rounded-lg font-medium whitespace-nowrap"
                      >
                        Use Current
                      </button>
                    </div>
                  </div>
                  
                  {/* Recap End */}
                  <div className="mb-6">
                    <label className="text-sm font-medium mb-2 block">Recap End (seconds)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={localRecapEnd}
                        onChange={(e) => setLocalRecapEnd(parseInt(e.target.value) || 0)}
                        min={0}
                        className="flex-1 bg-secondary rounded-lg px-4 py-3 text-foreground font-mono"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocalRecapEnd(Math.floor(currentTime));
                          toast.info(`Recap end set to ${formatTime(currentTime)}`);
                        }}
                        className="px-4 py-3 bg-purple-500 text-white rounded-lg font-medium whitespace-nowrap"
                      >
                        Use Current
                      </button>
                    </div>
                  </div>
                  
                  {/* Duration Preview */}
                  {localRecapEnd > localRecapStart && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-4">
                      <p className="text-sm text-purple-400">
                        Recap duration: {formatTime(localRecapEnd - localRecapStart)} ({localRecapEnd - localRecapStart} seconds)
                      </p>
                    </div>
                  )}
                  
                  {/* Save Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveRecapTimes();
                    }}
                    disabled={isSavingRecap || localRecapEnd <= localRecapStart}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors",
                      isSavingRecap || localRecapEnd <= localRecapStart
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-white"
                    )}
                  >
                    {isSavingRecap ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    {isSavingRecap ? "Saving..." : "Save Recap Times"}
                  </button>
                  
                  {localRecapEnd <= localRecapStart && localRecapEnd !== 0 && (
                    <p className="text-destructive text-sm mt-2 text-center">
                      Recap end must be greater than recap start
                    </p>
                  )}
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
