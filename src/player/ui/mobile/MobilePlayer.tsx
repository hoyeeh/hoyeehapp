import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Maximize, ChevronLeft, Loader2, Lock, Unlock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toCdnUrl } from "@/utils/cdnUrl";
import { formatTime } from "@/player/core/utils/time";
import { createShakaAdapter, PlayerAdapter } from "@/player/adapters/playback";
import { CastButton } from "@/components/player/CastButton";
import { Slider } from "@/components/ui/slider";

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
  thumbnail?: string;
}

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
  thumbnail,
}: MobilePlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmutePrompt, setShowUnmutePrompt] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeFromTime, setResumeFromTime] = useState(0);

  // Initialize Shaka adapter
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const adapter = createShakaAdapter({ debug: localStorage.getItem('HOYEEH_DEBUG') === '1' });
    adapterRef.current = adapter;

    const initAdapter = async () => {
      await adapter.init(video);

      adapter.on('loadstart', () => setIsBuffering(true));
      
      adapter.on('loadedmetadata', (data) => {
        setDuration(data?.duration || 0);
        if (initialProgress > 30 && data?.duration && initialProgress < data.duration * 0.95) {
          setResumeFromTime(initialProgress);
          setShowResumePrompt(true);
          adapter.pause();
        } else if (initialProgress > 0) {
          adapter.seek(initialProgress);
        }
      });

      adapter.on('timeupdate', (data) => {
        setCurrentTime(data?.currentTime || 0);
        const time = data?.currentTime || 0;
        if (introEndTime > introStartTime && time >= introStartTime && time < introEndTime) {
          setShowSkipIntro(true);
        } else {
          setShowSkipIntro(false);
        }
      });

      adapter.on('play', () => {
        setIsPlaying(true);
        setIsBuffering(false);
      });

      adapter.on('pause', () => setIsPlaying(false));
      adapter.on('waiting', () => setIsBuffering(true));
      
      adapter.on('playing', () => {
        setIsBuffering(false);
        setIsPlaying(true);
      });

      adapter.on('ended', () => {
        setIsPlaying(false);
        onEnded?.();
      });

      adapter.on('volumechange', (data) => {
        setIsMuted(data?.muted || false);
        if (!data?.muted) setShowUnmutePrompt(false);
      });

      const cdnSrc = toCdnUrl(src);
      await adapter.load(cdnSrc, 0, { title, contentId, episodeId, thumbnail });
    };

    initAdapter();

    return () => {
      adapter.destroy();
      adapterRef.current = null;
    };
  }, [src, contentId]);

  // Controls visibility
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isLocked) setShowControls(false);
    }, 3000);
  }, [isPlaying, isLocked]);

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

  const togglePlay = () => {
    if (!adapterRef.current || isLocked) return;
    if (isPlaying) {
      adapterRef.current.pause();
    } else {
      adapterRef.current.play();
    }
  };

  const unmute = () => {
    if (!adapterRef.current) return;
    adapterRef.current.setMuted(false);
    setShowUnmutePrompt(false);
  };

  const handleSeek = (value: number[]) => {
    if (!adapterRef.current || isLocked) return;
    adapterRef.current.seek(value[0]);
  };

  const skip = (seconds: number) => {
    if (!adapterRef.current || isLocked) return;
    adapterRef.current.seek(currentTime + seconds);
  };

  const skipIntro = () => {
    if (!adapterRef.current) return;
    adapterRef.current.seek(introEndTime);
    setShowSkipIntro(false);
  };

  const handleResume = () => {
    setShowResumePrompt(false);
    adapterRef.current?.seek(resumeFromTime);
    adapterRef.current?.play();
  };

  const handleStartOver = () => {
    setShowResumePrompt(false);
    adapterRef.current?.seek(0);
    adapterRef.current?.play();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      await containerRef.current.requestFullscreen?.();
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

      {/* Skip Intro Button */}
      {showSkipIntro && !isLocked && (
        <button
          onClick={(e) => { e.stopPropagation(); skipIntro(); }}
          className="absolute bottom-28 right-4 px-5 py-2.5 bg-foreground/90 text-background rounded-lg font-semibold z-10"
        >
          Skip Intro
        </button>
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
            {/* Top Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto safe-area-inset-top">
              <div className="flex items-center justify-between">
                <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="flex items-center gap-2 text-white">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <h2 className="text-white font-medium truncate max-w-[60%]">{title}</h2>
                <div className="flex items-center gap-2">
                  <CastButton 
                    videoUrl={src} 
                    videoTitle={title} 
                    videoThumbnail={thumbnail}
                    onOpenFullscreen={toggleFullscreen}
                  />
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
                <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white">
                  <Maximize className="h-6 w-6" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
