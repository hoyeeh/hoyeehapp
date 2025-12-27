import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, SkipBack, Volume2,
  Maximize, ArrowLeft, Loader2, Home
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toCdnUrl } from "@/utils/cdnUrl";
import { formatTime } from "@/player/core/utils/time";
import { createShakaAdapter, PlayerAdapter } from "@/player/adapters/playback";
import { CastButton } from "@/components/player/CastButton";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface KidsPlayerProps {
  src: string;
  title: string;
  contentId: string;
  episodeId?: string;
  initialProgress?: number;
  onClose: () => void;
  onEnded?: () => void;
  thumbnail?: string;
  // Parental settings
  allowSeeking?: boolean;
  maxVolume?: number; // 0-100
  autoplayNextEpisode?: boolean;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  // Cast settings
  allowCast?: boolean;
}

export const KidsPlayer = ({
  src,
  title,
  contentId,
  episodeId,
  initialProgress = 0,
  onClose,
  onEnded,
  thumbnail,
  allowSeeking = true,
  maxVolume = 100,
  autoplayNextEpisode = true,
  onNextEpisode,
  hasNextEpisode,
  allowCast = false,
}: KidsPlayerProps) => {
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
  const [volume, setVolume] = useState(maxVolume / 100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNextEpisode, setShowNextEpisode] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(10);

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
        if (initialProgress > 0 && data?.duration && initialProgress < data.duration * 0.95) {
          adapter.seek(initialProgress);
        }
      });

      adapter.on('timeupdate', (data) => {
        setCurrentTime(data?.currentTime || 0);
        if (hasNextEpisode && data?.duration && data.currentTime >= data.duration - 30) {
          setShowNextEpisode(true);
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
        if (autoplayNextEpisode && hasNextEpisode && onNextEpisode) {
          onNextEpisode();
        } else {
          onEnded?.();
        }
      });

      adapter.on('volumechange', (data) => {
        const vol = data?.volume || 0;
        const maxVol = maxVolume / 100;
        if (vol > maxVol) {
          adapter.setVolume(maxVol);
        } else {
          setVolume(vol);
        }
        setIsMuted(data?.muted || false);
        if (!data?.muted) setShowUnmutePrompt(false);
      });

      const cdnSrc = toCdnUrl(src);
      await adapter.load(cdnSrc, 0, { title, contentId, episodeId, thumbnail });
      adapter.setVolume(maxVolume / 100);
    };

    initAdapter();

    return () => {
      adapter.destroy();
      adapterRef.current = null;
    };
  }, [src, contentId, maxVolume]);

  // Next episode countdown
  useEffect(() => {
    if (!showNextEpisode || nextEpisodeCountdown <= 0) return;
    const timer = setInterval(() => {
      setNextEpisodeCountdown((prev) => {
        if (prev <= 1 && autoplayNextEpisode && onNextEpisode) {
          onNextEpisode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showNextEpisode, autoplayNextEpisode, onNextEpisode]);

  // Controls visibility
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 4000);
  }, [isPlaying]);

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
    if (!adapterRef.current) return;
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
    if (!adapterRef.current || !allowSeeking) return;
    adapterRef.current.seek(value[0]);
  };

  const skip = (seconds: number) => {
    if (!adapterRef.current || !allowSeeking) return;
    adapterRef.current.seek(currentTime + seconds);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      await containerRef.current.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  const handleTap = () => {
    resetControlsTimeout();
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0A0A0F]"
      onTouchStart={handleTap}
      onClick={handleTap}
    >
      {/* Kids-themed decorative elements */}
      <div className="absolute bottom-4 left-4 w-20 h-20 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-xl pointer-events-none" />
      <div className="absolute bottom-8 right-8 w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 blur-xl pointer-events-none" />
      <div className="absolute top-20 right-20 w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500/15 to-orange-500/15 blur-xl pointer-events-none" />

      {/* Video Container */}
      <div className="relative w-full h-full flex items-center justify-center p-4 pt-20">
        <div className="w-full max-w-5xl aspect-video rounded-3xl overflow-hidden shadow-2xl relative bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            muted={isMuted}
            poster={thumbnail}
          />

          {/* Buffering Indicator */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-3xl">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-12 w-12 text-white animate-spin" />
                <span className="text-white/70 text-sm font-medium">Loading video...</span>
              </div>
            </div>
          )}

          {/* Large Unmute Overlay (Kids-friendly) */}
          {showUnmutePrompt && !isBuffering && (
            <div
              onClick={(e) => { e.stopPropagation(); unmute(); }}
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-3xl cursor-pointer z-20"
            >
              <div className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 p-8 rounded-3xl text-center backdrop-blur-sm">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
                  <Volume2 className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Tap to hear sound!</h3>
                <p className="text-white/60">Click anywhere to enable audio</p>
              </div>
            </div>
          )}

          {/* Center Play Button (when paused) */}
          {!isPlaying && !isBuffering && !showUnmutePrompt && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Button
                size="lg"
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-20 h-20 rounded-full bg-white hover:bg-white/90 shadow-2xl"
              >
                <Play className="h-10 w-10 fill-[#0A0A0F] text-[#0A0A0F] ml-1" />
              </Button>
            </div>
          )}

          {/* Next Episode Prompt */}
          {showNextEpisode && hasNextEpisode && (
            <div className="absolute bottom-24 right-6 bg-gradient-to-br from-violet-500/90 to-fuchsia-600/90 p-4 rounded-2xl z-20">
              <p className="text-white font-bold mb-2">Next episode in {nextEpisodeCountdown}s</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowNextEpisode(false); }}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onNextEpisode?.(); }}
                  className="bg-white text-violet-600 hover:bg-white/90"
                >
                  Play Now
                </Button>
              </div>
            </div>
          )}

          {/* Controls Overlay */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top gradient */}
                <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
                
                {/* Bottom gradient & controls */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-auto">
                  {/* Progress Bar (only if seeking allowed) */}
                  {allowSeeking && (
                    <div className="mb-4">
                      <Slider
                        value={[currentTime]}
                        max={duration || 100}
                        step={1}
                        onValueChange={handleSeek}
                        className="cursor-pointer [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:bg-white [&_.bg-primary]:bg-gradient-to-r [&_.bg-primary]:from-violet-500 [&_.bg-primary]:to-fuchsia-500"
                      />
                    </div>
                  )}

                  {/* Controls Row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/80 text-sm font-medium min-w-[90px]">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>

                    <div className="flex items-center gap-1">
                      {allowSeeking && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); skip(-10); }}
                          className="text-white hover:bg-white/20 h-11 w-11 rounded-xl"
                        >
                          <SkipBack className="h-5 w-5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        className="text-white hover:bg-white/20 h-14 w-14 rounded-xl"
                      >
                        {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 fill-current" />}
                      </Button>
                      {allowSeeking && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); skip(10); }}
                          className="text-white hover:bg-white/20 h-11 w-11 rounded-xl"
                        >
                          <SkipForward className="h-5 w-5" />
                        </Button>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                      className="text-white hover:bg-white/20 h-11 w-11 rounded-xl"
                    >
                      <Maximize className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent safe-area-inset-top z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm text-white font-medium hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <h1 className="text-lg font-semibold text-white truncate max-w-md mx-4">
            {title}
          </h1>

          <div className="flex items-center gap-2">
            {allowCast && (
              <CastButton
                videoUrl={src}
                videoTitle={title}
                videoThumbnail={thumbnail}
                onOpenFullscreen={toggleFullscreen}
                isKidsMode={true}
                showCastEnabled={true}
              />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-medium hover:from-violet-600 hover:to-fuchsia-700 transition-colors"
            >
              <Home className="h-5 w-5" />
              <span className="hidden sm:inline">Kids Home</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
