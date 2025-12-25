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
  Wifi,
  WifiOff,
  Airplay,
  Monitor,
  Loader,
  HelpCircle,
  FolderOpen,
  Home,
  Bed,
  Sofa,
  UtensilsCrossed,
  Folder,
  Check,
  Users,
} from "lucide-react";
import { useWatchPartyContext } from "@/contexts/WatchPartyContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { useWatchProgress } from "@/hooks/useWatchProgress";
import { useGoogleCast } from "@/hooks/useGoogleCast";
import { usePictureInPicture } from "@/hooks/usePictureInPicture";
import { useDLNA } from "@/hooks/useDLNA";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { useAirPlay } from "@/hooks/useAirPlay";
import { useCastHistory } from "@/hooks/useCastHistory";
import { CastController } from "@/components/CastController";
import { CastSetupGuide } from "@/components/cast/CastSetupGuide";
import { DeviceGroupManager } from "@/components/cast/DeviceGroupManager";
import { NativeCastButton } from "@/components/cast/NativeCastButton";
import { AirPlayButton } from "@/components/cast/AirPlayButton";
import { CastPanel } from "@/components/cast/CastPanel";
import { CastToTVButton } from "@/components/cast/CastToTVButton";
import { toast } from "sonner";
import { toCdnUrl } from "@/utils/cdnUrl";
import { supabase } from "@/integrations/supabase/client";
import { useSkipPreferences } from "@/hooks/useSkipPreferences";
import { useIsAdmin } from "@/hooks/useAdmin";

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
  episodeId?: string;
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
  episodeId,
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
  const [isMuted, setIsMuted] = useState(true); // Start muted for mobile autoplay support
  const [showTapToPlay, setShowTapToPlay] = useState(false); // Fallback for blocked autoplay
  const [isActivelyPlaying, setIsActivelyPlaying] = useState(false); // Track if user is actively watching
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
  const [showSkipRecap, setShowSkipRecap] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(10);
  const nextEpisodeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [volumeIndicatorLevel, setVolumeIndicatorLevel] = useState(0);
  const volumeIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeFromTime, setResumeFromTime] = useState(0);
  
  // Admin settings for intro/recap setter
  const { data: isAdmin } = useIsAdmin();
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [localIntroStart, setLocalIntroStart] = useState<number>(introStartTime);
  const [localIntroEnd, setLocalIntroEnd] = useState<number>(introEndTime);
  const [localRecapStart, setLocalRecapStart] = useState<number>(recapStartTime ?? 0);
  const [localRecapEnd, setLocalRecapEnd] = useState<number>(recapEndTime ?? 0);
  const [isSavingIntro, setIsSavingIntro] = useState(false);
  const [isSavingRecap, setIsSavingRecap] = useState(false);

  // Skip preferences hook
  const skipPrefs = useSkipPreferences();
  const autoSkippedIntroRef = useRef(false);
  const autoSkippedRecapRef = useRef(false);
  const { saveProgressImmediately } = useWatchProgress({
    contentId,
    onProgressLoaded: useCallback((progress: number) => {
      setLoadedProgress(progress);
    }, []),
  });

  // Watch Party sync
  const { party, isHost, updatePlayback, syncToParty } = useWatchPartyContext();
  const lastPartySyncRef = useRef<number>(0);
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

  // Cast history hook for device memory and auto-reconnect
  const castHistory = useCastHistory();
  const [autoReconnectAttempted, setAutoReconnectAttempted] = useState(false);

  // AirPlay hook
  const airPlay = useAirPlay({
    onConnect: () => {
      const video = videoRef.current;
      if (video) {
        toast.success('Connected to AirPlay');
        castHistory.addDevice({
          id: 'airplay-device',
          name: airPlay.deviceName || 'AirPlay Device',
          type: 'airplay',
        });
      }
    },
    onDisconnect: () => {
      toast.info('Disconnected from AirPlay');
    },
  });

  // Set up AirPlay with video element
  useEffect(() => {
    if (videoRef.current) {
      airPlay.setupVideo(videoRef.current);
    }
  }, [airPlay.setupVideo]);

  // Track Chromecast connections in history
  useEffect(() => {
    if (cast.isConnected && cast.deviceName) {
      castHistory.addDevice({
        id: `chromecast-${cast.deviceName}`,
        name: cast.deviceName,
        type: 'chromecast',
      });
    }
  }, [cast.isConnected, cast.deviceName]);

  // Track DLNA connections in history
  useEffect(() => {
    if (dlna.connectedDevice) {
      castHistory.addDevice({
        id: dlna.connectedDevice.id,
        name: dlna.connectedDevice.name,
        type: 'dlna',
      });
    }
  }, [dlna.connectedDevice]);

  // Auto-reconnect to last used device on player load
  useEffect(() => {
    if (autoReconnectAttempted || !castHistory.lastUsedDevice) return;
    
    const attemptAutoReconnect = async () => {
      setAutoReconnectAttempted(true);
      const lastDevice = castHistory.lastUsedDevice;
      
      if (!lastDevice) return;

      // Only attempt reconnect if the device was used recently (within 24 hours)
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (lastDevice.lastUsed < twentyFourHoursAgo) return;

      if (lastDevice.type === 'chromecast' && cast.isAvailable) {
        toast.info(`Reconnecting to ${lastDevice.name}...`, { duration: 2000 });
        // Chromecast will auto-connect if device is available
        cast.connect();
      } else if (lastDevice.type === 'dlna') {
        toast.info('Scanning for your last DLNA device...', { duration: 2000 });
        dlna.scanForDevices();
      }
      // AirPlay doesn't support programmatic reconnection
    };

    // Delay auto-reconnect slightly to let video load first
    const timer = setTimeout(attemptAutoReconnect, 2000);
    return () => clearTimeout(timer);
  }, [castHistory.lastUsedDevice, autoReconnectAttempted, cast.isAvailable]);

  // Network quality for adaptive streaming
  const networkQuality = useNetworkQuality();
  const [useAdaptiveQuality, setUseAdaptiveQuality] = useState(true);

  // Check if source is HLS and detect available qualities
  useEffect(() => {
    const isHlsStream = src.includes('.m3u8');
    setIsHls(isHlsStream);
    
    if (isHlsStream) {
      // For Mux streams, these qualities are typically available
      setAvailableQualities(['auto', '1080', '720', '480']);
      
      // Set initial quality based on network if adaptive is enabled
      if (useAdaptiveQuality && networkQuality.recommendedQuality !== 'auto') {
        setSelectedQuality(networkQuality.recommendedQuality);
      }
    }
  }, [src]);

  // Auto-adjust quality when network changes (if adaptive is enabled)
  // Only adjust when NOT actively playing to prevent interruptions on mobile
  useEffect(() => {
    if (!useAdaptiveQuality || !isHls) return;
    
    // Don't interrupt active playback with quality changes
    if (isActivelyPlaying && isPlaying) return;
    
    if (networkQuality.recommendedQuality !== 'auto' && 
        networkQuality.recommendedQuality !== selectedQuality) {
      setSelectedQuality(networkQuality.recommendedQuality);
      toast.info(`Video quality adjusted to ${networkQuality.recommendedQuality}p based on your connection`);
    }
  }, [networkQuality.recommendedQuality, useAdaptiveQuality, isHls, isActivelyPlaying, isPlaying]);

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
      // Show resume prompt if there's significant progress (more than 30 seconds and less than 95% watched)
      if (startTime > 30 && video.duration > 0 && startTime < video.duration * 0.95) {
        setResumeFromTime(startTime);
        setShowResumePrompt(true);
        video.pause();
        setIsPlaying(false);
      } else if (startTime > 0) {
        video.currentTime = startTime;
      }
    };

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      // Determine effective intro times (use default if no specific times and default is set)
      const effectiveIntroStart = introStartTime;
      const effectiveIntroEnd = (introEndTime > 0) ? introEndTime : (skipPrefs.defaultIntroDuration > 0 ? skipPrefs.defaultIntroDuration : 0);
      const hasIntroSegment = effectiveIntroEnd > effectiveIntroStart;

      // Auto-skip intro if preference is enabled
      if (skipPrefs.autoSkipIntro && hasIntroSegment && time >= effectiveIntroStart && time < effectiveIntroEnd && !autoSkippedIntroRef.current) {
        autoSkippedIntroRef.current = true;
        video.currentTime = effectiveIntroEnd;
        setShowSkipIntro(false);
        toast.info('Intro skipped automatically', { duration: 2000 });
        return;
      }
      
      // Auto-skip recap if preference is enabled
      if (skipPrefs.autoSkipRecap && recapStartTime && recapEndTime && time >= recapStartTime && time < recapEndTime && !autoSkippedRecapRef.current) {
        autoSkippedRecapRef.current = true;
        video.currentTime = recapEndTime;
        setShowSkipRecap(false);
        toast.info('Recap skipped automatically', { duration: 2000 });
        return;
      }

      // Show skip intro button during intro segment (only if not auto-skipping)
      if (!skipPrefs.autoSkipIntro && hasIntroSegment && time >= effectiveIntroStart && time < effectiveIntroEnd) {
        setShowSkipIntro(true);
      } else {
        setShowSkipIntro(false);
      }

      // Show skip recap button during recap segment (only if not auto-skipping)
      if (!skipPrefs.autoSkipRecap && recapStartTime && recapEndTime && time >= recapStartTime && time < recapEndTime) {
        setShowSkipRecap(true);
      } else {
        setShowSkipRecap(false);
      }
      
      // Reset auto-skip flags when outside segments
      if (!hasIntroSegment || time < effectiveIntroStart || time >= effectiveIntroEnd) {
        autoSkippedIntroRef.current = false;
      }
      if (!recapStartTime || !recapEndTime || time < recapStartTime || time >= recapEndTime) {
        autoSkippedRecapRef.current = false;
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
      setIsPlaying(true);
      setIsActivelyPlaying(true); // Mark as actively playing
      setShowTapToPlay(false); // Hide tap to play overlay
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

  // Watch Party sync - sync video to party state for non-hosts
  useEffect(() => {
    if (!party || isHost) return;
    
    const video = videoRef.current;
    if (!video) return;

    // Sync video to party state
    syncToParty(video);
  }, [party?.playback_time, party?.is_playing, isHost, syncToParty]);

  // Watch Party - host sends playback updates
  useEffect(() => {
    if (!party || !isHost) return;
    
    const video = videoRef.current;
    if (!video) return;

    const handleHostTimeUpdate = () => {
      const now = Date.now();
      // Only send updates every second max
      if (now - lastPartySyncRef.current >= 1000) {
        lastPartySyncRef.current = now;
        updatePlayback(video.currentTime, !video.paused);
      }
    };

    const handleHostPlayPause = () => {
      updatePlayback(video.currentTime, !video.paused);
    };

    const handleHostSeeked = () => {
      updatePlayback(video.currentTime, !video.paused);
    };

    video.addEventListener('timeupdate', handleHostTimeUpdate);
    video.addEventListener('play', handleHostPlayPause);
    video.addEventListener('pause', handleHostPlayPause);
    video.addEventListener('seeked', handleHostSeeked);

    return () => {
      video.removeEventListener('timeupdate', handleHostTimeUpdate);
      video.removeEventListener('play', handleHostPlayPause);
      video.removeEventListener('pause', handleHostPlayPause);
      video.removeEventListener('seeked', handleHostSeeked);
    };
  }, [party, isHost, updatePlayback]);

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
      video.play()
        .then(() => {
          setIsPlaying(true);
          setShowTapToPlay(false);
        })
        .catch((error) => {
          console.error('[VideoPlayer] Play failed:', error);
          setShowTapToPlay(true);
          setIsPlaying(false);
        });
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

  const handleSkipRecap = () => {
    const video = videoRef.current;
    if (video && recapEndTime) {
      video.currentTime = recapEndTime;
      setShowSkipRecap(false);
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

  // Save intro times to database (for admins)
  const handleSaveIntroTimes = async () => {
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
      console.error("[VideoPlayer] Failed to save intro times:", error);
      toast.error("Failed to save intro times");
    } finally {
      setIsSavingIntro(false);
    }
  };

  // Save recap times to database (for admins)
  const handleSaveRecapTimes = async () => {
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
      console.error("[VideoPlayer] Failed to save recap times:", error);
      toast.error("Failed to save recap times");
    } finally {
      setIsSavingRecap(false);
    }
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
        muted={isMuted}
        playsInline
        onContextMenu={(e) => e.preventDefault()}
        onLoadedData={() => {
          // Attempt to play with proper error handling for mobile
          const video = videoRef.current;
          if (video) {
            video.play().catch(() => {
              // Autoplay blocked - show tap to play overlay
              setShowTapToPlay(true);
              setIsPlaying(false);
            });
          }
        }}
      />
      
      {/* Tap to Play Overlay (when autoplay blocked) */}
      {showTapToPlay && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-background/70 z-20"
          onClick={(e) => {
            e.stopPropagation();
            const video = videoRef.current;
            if (video) {
              video.play();
              setShowTapToPlay(false);
            }
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
              <Play className="h-10 w-10 text-white" fill="white" />
            </div>
            <span className="text-lg font-medium">Tap to Play</span>
          </div>
        </div>
      )}
      
      {/* Muted Indicator with Animation */}
      {isMuted && isPlaying && !showTapToPlay && !showResumePrompt && (
        <button
          className="absolute top-4 right-4 z-20 px-4 py-2 bg-background/80 backdrop-blur-sm rounded-full flex items-center gap-2 text-sm font-medium hover:bg-background transition-all duration-300 animate-fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(false);
            if (videoRef.current) {
              videoRef.current.muted = false;
              // Show volume indicator animation
              setVolumeIndicatorLevel(Math.round(volume * 100));
              setShowVolumeIndicator(true);
              if (volumeIndicatorTimeoutRef.current) {
                clearTimeout(volumeIndicatorTimeoutRef.current);
              }
              volumeIndicatorTimeoutRef.current = setTimeout(() => {
                setShowVolumeIndicator(false);
              }, 1500);
            }
          }}
        >
          <VolumeX className="h-4 w-4" />
          <span>Tap to unmute</span>
        </button>
      )}
      
      {/* Volume Indicator Animation */}
      {showVolumeIndicator && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none animate-scale-in">
          <div className="bg-background/90 backdrop-blur-md rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3">
            <div className="relative">
              <Volume2 className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${volumeIndicatorLevel}%` }}
              />
            </div>
            <span className="text-sm font-medium text-foreground">{volumeIndicatorLevel}%</span>
          </div>
        </div>
      )}
      
      {/* Resume Playback Prompt */}
      {showResumePrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-30 animate-fade-in">
          <div 
            className="bg-card/95 backdrop-blur-md rounded-xl p-6 shadow-2xl border border-border max-w-sm mx-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Play className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">Continue Watching?</h3>
                <p className="text-sm text-muted-foreground">
                  Resume from {formatTime(resumeFromTime)} or start from the beginning
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) {
                      video.currentTime = resumeFromTime;
                      video.play();
                      setShowResumePrompt(false);
                      setIsPlaying(true);
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4" fill="currentColor" />
                  Resume
                </button>
                <button
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) {
                      video.currentTime = 0;
                      video.play();
                      setShowResumePrompt(false);
                      setIsPlaying(true);
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Skip Recap Button */}
      {showSkipRecap && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSkipRecap();
          }}
          className="absolute bottom-32 left-4 sm:left-8 z-20 px-6 py-3 bg-purple-500/90 text-white font-semibold rounded-md hover:bg-purple-500 transition-colors shadow-lg"
        >
          Skip Recap
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
        <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 flex items-center gap-2 sm:gap-4 safe-area-inset-top">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand/80 flex items-center justify-center hover:bg-brand active:bg-brand/90 transition-colors touch-manipulation cursor-pointer"
            style={{ minWidth: 48, minHeight: 48 }}
          >
            <ArrowLeft className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
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
                    <button className="hidden sm:flex items-center gap-1.5 hover:text-brand transition-colors text-sm px-2 py-1 rounded bg-background/50">
                      {networkQuality.isOnline ? (
                        <Wifi className="h-3.5 w-3.5" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      {selectedQuality === 'auto' ? 'Auto' : `${selectedQuality}p`}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card min-w-[180px]">
                    {/* Network Status */}
                    <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-2">
                      {networkQuality.isOnline ? (
                        <>
                          <Wifi className="h-3 w-3" />
                          {networkQuality.effectiveType.toUpperCase()} • {networkQuality.downlink.toFixed(1)} Mbps
                        </>
                      ) : (
                        <>
                          <WifiOff className="h-3 w-3 text-amber-500" />
                          Offline
                        </>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Adaptive Quality Toggle */}
                    <DropdownMenuItem
                      onClick={() => setUseAdaptiveQuality(!useAdaptiveQuality)}
                      className="cursor-pointer"
                    >
                      <span className={cn(
                        "mr-2 w-3 h-3 rounded-full border-2",
                        useAdaptiveQuality ? "bg-brand border-brand" : "border-muted-foreground"
                      )} />
                      Auto-adjust quality
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    
                    {/* Quality Options */}
                    {QUALITY_OPTIONS.filter(q => availableQualities.includes(q.value)).map((quality) => (
                      <DropdownMenuItem
                        key={quality.value}
                        onClick={() => {
                          setSelectedQuality(quality.value);
                          if (quality.value !== 'auto') {
                            setUseAdaptiveQuality(false);
                          }
                        }}
                        className={cn(
                          "cursor-pointer",
                          selectedQuality === quality.value && "text-brand font-semibold"
                        )}
                      >
                        {quality.label}
                        {useAdaptiveQuality && networkQuality.recommendedQuality === quality.value && (
                          <span className="ml-auto text-xs text-muted-foreground">Recommended</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Playback Speed & Skip Preferences */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden sm:flex items-center gap-1 hover:text-brand transition-colors text-sm">
                    <Settings className="h-5 w-5" />
                    {playbackRate}x
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card min-w-[200px]">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Playback Speed</DropdownMenuLabel>
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
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Auto-Skip Preferences</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      skipPrefs.toggleAutoSkipIntro();
                    }}
                    className="cursor-pointer flex items-center justify-between"
                  >
                    <span>Auto-skip intros</span>
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                      skipPrefs.autoSkipIntro ? "bg-brand border-brand" : "border-muted-foreground"
                    )}>
                      {skipPrefs.autoSkipIntro && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      skipPrefs.toggleAutoSkipRecap();
                    }}
                    className="cursor-pointer flex items-center justify-between"
                  >
                    <span>Auto-skip recaps</span>
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                      skipPrefs.autoSkipRecap ? "bg-brand border-brand" : "border-muted-foreground"
                    )}>
                      {skipPrefs.autoSkipRecap && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Default Intro Duration</DropdownMenuLabel>
                  <div className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <select
                        value={skipPrefs.defaultIntroDuration}
                        onChange={(e) => skipPrefs.setDefaultIntroDuration(Number(e.target.value))}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-secondary text-foreground rounded px-2 py-1 text-sm"
                      >
                        <option value={0}>Disabled</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>60 seconds</option>
                        <option value={90}>90 seconds</option>
                        <option value={120}>2 minutes</option>
                      </select>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Used when no specific intro time is set
                    </p>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Watch Party Button */}
              <button
                onClick={() => {
                  // Open watch party panel - dispatch custom event with content info
                  window.dispatchEvent(new CustomEvent('toggleWatchParty', {
                    detail: {
                      contentId,
                      episodeId,
                      contentTitle: title
                    }
                  }));
                }}
                className={cn(
                  "hidden sm:flex items-center gap-1 hover:text-brand transition-colors text-sm px-2 py-1 rounded",
                  party && "bg-brand/20 text-brand"
                )}
                title={party ? `In party: ${party.party_code}` : "Start or join a watch party"}
              >
                <Users className="h-5 w-5" />
                {party ? "Party" : "Watch Party"}
              </button>

              {/* Admin Settings Button - only show for admins when episode is selected */}
              {isAdmin && episodeId && (
                <button
                  onClick={() => setShowAdminSettings(!showAdminSettings)}
                  className={cn(
                    "hidden sm:flex items-center gap-1 hover:text-brand transition-colors text-sm px-2 py-1 rounded",
                    showAdminSettings && "bg-brand/20 text-brand"
                  )}
                  title="Admin: Set intro/recap times"
                >
                  <Settings className="h-5 w-5" />
                  Admin
                </button>
              )}

              {/* Native Cast Buttons */}
              <NativeCastButton
                videoUrl={src}
                videoTitle={title}
                startTime={currentTime}
                onConnect={() => {
                  const video = videoRef.current;
                  if (video) {
                    video.pause();
                    setIsPlaying(false);
                    setIsCasting(true);
                  }
                }}
                onDisconnect={() => setIsCasting(false)}
                className="hidden sm:flex"
              />
              
              <AirPlayButton
                videoRef={videoRef}
                onConnect={() => {
                  castHistory.addDevice({
                    id: 'airplay-device',
                    name: 'AirPlay Device',
                    type: 'airplay',
                  });
                }}
                className="hidden sm:flex"
              />

              {/* Cast Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "p-2 rounded-full transition-colors sm:hidden",
                      (cast.isConnected || isDLNACasting || airPlay.isConnected)
                        ? "text-brand bg-brand/20 hover:bg-brand/30" 
                        : "hover:text-brand hover:bg-muted"
                    )}
                    title="Cast to device"
                  >
                    <Cast className={cn("h-5 w-5", (cast.isConnected || isDLNACasting || airPlay.isConnected) && "fill-current")} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card min-w-[220px]">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Cast to Device
                  </DropdownMenuLabel>
                  
                  {/* Google Chromecast - Always visible */}
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
                    disabled={!cast.isAvailable && !cast.isConnected}
                  >
                    <Cast className={cn(
                      "mr-2 h-4 w-4",
                      cast.isConnected && "text-brand"
                    )} />
                    <div className="flex flex-col">
                      <span className={cn(cast.isConnected && "text-brand font-medium")}>
                        {cast.isConnected 
                          ? `Casting to ${cast.deviceName}` 
                          : 'Chromecast'}
                      </span>
                      {!cast.isAvailable && !cast.isConnected && (
                        <span className="text-xs text-muted-foreground">
                          No devices found
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* DLNA/UPnP - Always visible */}
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
                    <Tv className={cn(
                      "mr-2 h-4 w-4",
                      dlna.connectedDevice && "text-brand"
                    )} />
                    <div className="flex flex-col">
                      <span className={cn(dlna.connectedDevice && "text-brand font-medium")}>
                        {dlna.connectedDevice 
                          ? `Connected: ${dlna.connectedDevice.name}` 
                          : 'DLNA/UPnP TV'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dlna.isScanning 
                          ? 'Scanning for devices...' 
                          : dlna.devices.length > 0 
                            ? `${dlna.devices.length} device(s) found`
                            : 'Tap to scan'}
                      </span>
                    </div>
                    {dlna.isScanning && (
                      <Loader className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </DropdownMenuItem>
                  
                  {/* DLNA Device List */}
                  {dlna.devices.length > 0 && (
                    <>
                      {dlna.devices.map((device) => (
                        <DropdownMenuItem
                          key={device.id}
                          onClick={() => dlna.connectToDevice(device)}
                          className="cursor-pointer pl-8"
                        >
                          <Monitor className="mr-2 h-4 w-4" />
                          {device.name}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {/* AirPlay - Always visible */}
                  <DropdownMenuItem
                    onClick={() => {
                      if (airPlay.isAvailable) {
                        airPlay.showPicker();
                      } else {
                        toast.info('AirPlay is only available in Safari on Mac/iOS');
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Airplay className={cn(
                      "mr-2 h-4 w-4",
                      airPlay.isConnected && "text-brand"
                    )} />
                    <div className="flex flex-col">
                      <span className={cn(airPlay.isConnected && "text-brand font-medium")}>
                        {airPlay.isConnected 
                          ? `AirPlay: ${airPlay.deviceName || 'Connected'}` 
                          : 'AirPlay'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {airPlay.isAvailable 
                          ? 'Tap to select device' 
                          : 'Safari only'}
                      </span>
                    </div>
                  </DropdownMenuItem>
                  
                  {/* Device Groups */}
                  {castHistory.groups.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Device Groups
                      </DropdownMenuLabel>
                      {castHistory.groups.map((group) => {
                        const groupDevices = castHistory.getDevicesByGroup(group.id);
                        if (groupDevices.length === 0) return null;
                        
                        const getGroupIcon = () => {
                          switch (group.icon) {
                            case 'home': return Home;
                            case 'living': return Sofa;
                            case 'bedroom': return Bed;
                            case 'kitchen': return UtensilsCrossed;
                            case 'office': return Monitor;
                            case 'tv': return Tv;
                            default: return Folder;
                          }
                        };
                        const GroupIcon = getGroupIcon();
                        
                        return (
                          <DropdownMenuItem
                            key={group.id}
                            onClick={() => {
                              const device = groupDevices[0];
                              if (device.type === 'chromecast') {
                                cast.connect();
                              } else if (device.type === 'dlna') {
                                dlna.scanForDevices();
                                toast.info(`Looking for ${castHistory.getDeviceDisplayName(device)}...`);
                              } else if (device.type === 'airplay' && airPlay.isAvailable) {
                                airPlay.showPicker();
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <GroupIcon className="mr-2 h-4 w-4 text-brand" />
                            <div className="flex flex-col">
                              <span>{group.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {groupDevices.length} device{groupDevices.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </>
                  )}

                  {/* Recent Devices (ungrouped) */}
                  {castHistory.getUngroupedDevices().length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Recent Devices
                      </DropdownMenuLabel>
                      {castHistory.getUngroupedDevices().slice(0, 3).map((device) => (
                        <DropdownMenuItem
                          key={`${device.type}-${device.id}`}
                          onClick={() => {
                            if (device.type === 'chromecast') {
                              cast.connect();
                            } else if (device.type === 'dlna') {
                              dlna.scanForDevices();
                              toast.info(`Looking for ${castHistory.getDeviceDisplayName(device)}...`);
                            } else if (device.type === 'airplay' && airPlay.isAvailable) {
                              airPlay.showPicker();
                            }
                          }}
                          className="cursor-pointer"
                        >
                          {device.type === 'chromecast' && <Cast className="mr-2 h-4 w-4" />}
                          {device.type === 'dlna' && <Tv className="mr-2 h-4 w-4" />}
                          {device.type === 'airplay' && <Airplay className="mr-2 h-4 w-4" />}
                          <span className="truncate">{castHistory.getDeviceDisplayName(device)}</span>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {/* Management Links */}
                  <div className="px-2 py-1.5 space-y-1">
                    <DeviceGroupManager
                      trigger={
                        <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                          <FolderOpen className="h-3.5 w-3.5" />
                          Manage device groups
                        </button>
                      }
                    />
                    <CastSetupGuide
                      trigger={
                        <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                          <HelpCircle className="h-3.5 w-3.5" />
                          Need help setting up?
                        </button>
                      }
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Cast to TV Button - QR Code Pairing */}
              <CastToTVButton
                videoUrl={src}
                videoTitle={title}
                startTime={currentTime}
                duration={duration}
                className="hidden sm:flex"
              />

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

      {/* Admin Settings Panel - Intro/Recap Setter */}
      {showAdminSettings && isAdmin && episodeId && (
        <div className="absolute top-16 right-4 w-80 bg-card/95 backdrop-blur-md rounded-lg shadow-xl border border-border p-4 z-50 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Admin Settings</h3>
            <button
              onClick={() => setShowAdminSettings(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
          
          {/* Current Time Reference */}
          <div className="bg-secondary/50 rounded-lg p-3 mb-4">
            <p className="text-sm text-muted-foreground mb-1">Current Position</p>
            <p className="text-xl font-mono font-bold text-primary">{formatTime(currentTime)}</p>
            <p className="text-xs text-muted-foreground">({Math.floor(currentTime)} seconds)</p>
          </div>
          
          {/* Intro Settings */}
          <div className="mb-6">
            <h4 className="font-medium mb-3 flex items-center gap-2 text-blue-400">
              <SkipForward className="h-4 w-4" />
              Intro Skip
            </h4>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start (seconds)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={localIntroStart}
                    onChange={(e) => setLocalIntroStart(parseInt(e.target.value) || 0)}
                    min={0}
                    className="flex-1 bg-secondary rounded px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={() => {
                      setLocalIntroStart(Math.floor(currentTime));
                      toast.info(`Intro start: ${formatTime(currentTime)}`);
                    }}
                    className="px-3 py-2 bg-blue-500 text-white rounded text-xs font-medium"
                  >
                    Use
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">End (seconds)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={localIntroEnd}
                    onChange={(e) => setLocalIntroEnd(parseInt(e.target.value) || 0)}
                    min={0}
                    className="flex-1 bg-secondary rounded px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={() => {
                      setLocalIntroEnd(Math.floor(currentTime));
                      toast.info(`Intro end: ${formatTime(currentTime)}`);
                    }}
                    className="px-3 py-2 bg-blue-500 text-white rounded text-xs font-medium"
                  >
                    Use
                  </button>
                </div>
              </div>
              
              {localIntroEnd > localIntroStart && (
                <p className="text-xs text-blue-400">
                  Duration: {formatTime(localIntroEnd - localIntroStart)}
                </p>
              )}
              
              <button
                onClick={handleSaveIntroTimes}
                disabled={isSavingIntro || localIntroEnd <= localIntroStart}
                className={cn(
                  "w-full py-2 rounded text-sm font-medium transition-colors",
                  isSavingIntro || localIntroEnd <= localIntroStart
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                )}
              >
                {isSavingIntro ? "Saving..." : "Save Intro"}
              </button>
            </div>
          </div>
          
          {/* Recap Settings */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2 text-purple-400">
              <SkipBack className="h-4 w-4" />
              Recap Skip
            </h4>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Start (seconds)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={localRecapStart}
                    onChange={(e) => setLocalRecapStart(parseInt(e.target.value) || 0)}
                    min={0}
                    className="flex-1 bg-secondary rounded px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={() => {
                      setLocalRecapStart(Math.floor(currentTime));
                      toast.info(`Recap start: ${formatTime(currentTime)}`);
                    }}
                    className="px-3 py-2 bg-purple-500 text-white rounded text-xs font-medium"
                  >
                    Use
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">End (seconds)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={localRecapEnd}
                    onChange={(e) => setLocalRecapEnd(parseInt(e.target.value) || 0)}
                    min={0}
                    className="flex-1 bg-secondary rounded px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={() => {
                      setLocalRecapEnd(Math.floor(currentTime));
                      toast.info(`Recap end: ${formatTime(currentTime)}`);
                    }}
                    className="px-3 py-2 bg-purple-500 text-white rounded text-xs font-medium"
                  >
                    Use
                  </button>
                </div>
              </div>
              
              {localRecapEnd > localRecapStart && (
                <p className="text-xs text-purple-400">
                  Duration: {formatTime(localRecapEnd - localRecapStart)}
                </p>
              )}
              
              <button
                onClick={handleSaveRecapTimes}
                disabled={isSavingRecap || (localRecapEnd <= localRecapStart && localRecapEnd !== 0)}
                className={cn(
                  "w-full py-2 rounded text-sm font-medium transition-colors",
                  isSavingRecap || (localRecapEnd <= localRecapStart && localRecapEnd !== 0)
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-purple-500 text-white hover:bg-purple-600"
                )}
              >
                {isSavingRecap ? "Saving..." : "Save Recap"}
              </button>
            </div>
          </div>
        </div>
      )}

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