import { useState, useEffect, useRef, useCallback } from "react";

interface UseBannerVideoPreviewOptions {
  videoUrl?: string;
  enabled?: boolean;
  delay?: number; // ms before starting video
  startTime?: number; // seconds into video to start
  duration?: number; // how long to play before looping (seconds)
}

export const useBannerVideoPreview = ({
  videoUrl,
  enabled = true,
  delay = 2000,
  startTime = 0,
  duration,
}: UseBannerVideoPreviewOptions) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasError, setHasError] = useState(false);
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when video URL changes
  useEffect(() => {
    setIsVideoReady(false);
    setIsVideoPlaying(false);
    setHasError(false);
    
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
    }
    
    return () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
      }
    };
  }, [videoUrl]);

  // Handle video load and playback
  useEffect(() => {
    if (!enabled || !videoUrl || hasError) return;
    
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      setIsVideoReady(true);
      // Seek to start position
      video.currentTime = startTime;
      // Start playing after delay
      startTimeoutRef.current = setTimeout(() => {
        video.play().then(() => {
          setIsVideoPlaying(true);
        }).catch(() => {
          setHasError(true);
        });
      }, delay);
    };

    const handleError = () => {
      setHasError(true);
      setIsVideoPlaying(false);
    };

    const handleTimeUpdate = () => {
      // If duration is set, loop back to startTime after duration
      if (duration && video.currentTime >= startTime + duration) {
        video.currentTime = startTime;
      }
    };

    const handleEnded = () => {
      // Loop the video back to startTime
      video.currentTime = startTime;
      video.play().catch(() => setHasError(true));
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [enabled, videoUrl, delay, hasError, startTime, duration]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  const pauseVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  }, []);

  const playVideo = useCallback(() => {
    if (videoRef.current && isVideoReady) {
      videoRef.current.play().then(() => {
        setIsVideoPlaying(true);
      }).catch(() => {
        setHasError(true);
      });
    }
  }, [isVideoReady]);

  return {
    videoRef,
    isVideoReady,
    isVideoPlaying,
    isMuted,
    hasError,
    toggleMute,
    pauseVideo,
    playVideo,
  };
};
