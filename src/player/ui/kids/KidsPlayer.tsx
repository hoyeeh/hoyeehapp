import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Maximize, ArrowLeft, Loader2, Home, Subtitles
} from "lucide-react";
import { LogoOpener } from "@/components/LogoOpener";
import { useLogoOpener } from "@/hooks/useLogoOpener";
import { cn } from "@/lib/utils";
import { toCdnUrl } from "@/utils/cdnUrl";
import { createPlayer, formatTime, PlayerInstance } from "@/player";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useSubtitles } from "@/hooks/useSubtitles";
import { SubtitleDisplay } from "@/components/SubtitleDisplay";
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
  thumbnail?: string;
}

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
  nextEpisodeInfo?: NextEpisodeInfo;
  // Skip recap
  recapStartTime?: number;
  recapEndTime?: number;
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
  nextEpisodeInfo,
  recapStartTime,
  recapEndTime,
}: KidsPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
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
  const [bingeMode, setBingeMode] = useState(() => localStorage.getItem('kidsPlayer_bingeMode') === 'true');
  const [showSkipRecap, setShowSkipRecap] = useState(false);

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
      platform: 'kids',
      debug: localStorage.getItem('HOYEEH_DEBUG') === '1',
      onEvent: (event, data: any) => {
        switch (event) {
          case 'loadstart':
            setIsBuffering(true);
            break;
          case 'loadedmetadata':
            setDuration(data?.duration || 0);
            if (initialProgress > 0 && data?.duration && initialProgress < data.duration * 0.95) {
              player.seek(initialProgress);
            }
            break;
          case 'timeupdate':
            setCurrentTime(data?.currentTime || 0);
            updateCurrentCue(data?.currentTime || 0);
            // Show skip recap button
            if (recapStartTime && recapEndTime) {
              const inRecap = data?.currentTime >= recapStartTime && data?.currentTime < recapEndTime;
              setShowSkipRecap(inRecap);
            }
            // Show next episode prompt
            if (hasNextEpisode && data?.duration && data.currentTime >= data.duration - 30) {
              setShowNextEpisode(true);
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
            if (autoplayNextEpisode && hasNextEpisode && onNextEpisode) {
              onNextEpisode();
            } else {
              onEnded?.();
            }
            break;
          case 'volumechange':
            const vol = data?.volume || 0;
            const maxVol = maxVolume / 100;
            if (vol > maxVol) {
              player.setVolume(maxVol);
            } else {
              setVolume(vol);
            }
            setIsMuted(data?.muted || false);
            if (!data?.muted) setShowUnmutePrompt(false);
            break;
        }
      },
    });

    playerRef.current = player;
    const cdnSrc = toCdnUrl(src);
    player.load(cdnSrc, 0, { title, contentId, episodeId, thumbnail });
    // Set initial volume clamped to max
    player.setVolume(maxVolume / 100);

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [src, contentId, maxVolume]);

  // Next episode countdown - uses binge mode for faster countdown
  useEffect(() => {
    if (!showNextEpisode) return;
    // Set initial countdown based on binge mode
    setNextEpisodeCountdown(bingeMode ? 5 : 10);
  }, [showNextEpisode, bingeMode]);

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
  }, [showNextEpisode, autoplayNextEpisode, onNextEpisode, nextEpisodeCountdown]);

  // Binge mode persistence
  const toggleBingeMode = useCallback(() => {
    setBingeMode(prev => {
      const newValue = !prev;
      localStorage.setItem('kidsPlayer_bingeMode', String(newValue));
      return newValue;
    });
  }, []);

  // Skip recap function
  const skipRecap = useCallback(() => {
    if (!playerRef.current || !recapEndTime) return;
    playerRef.current.seek(recapEndTime);
    setShowSkipRecap(false);
  }, [recapEndTime]);

  // Controls visibility - 5 second auto-hide
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        setShowControls(false);
      }
    }, 5000);
  }, []);

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
    if (!playerRef.current) return;
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
    if (!playerRef.current || !allowSeeking) return;
    playerRef.current.seek(value[0]);
  };

  const skip = (seconds: number) => {
    if (!playerRef.current || !allowSeeking) return;
    playerRef.current.seek(currentTime + seconds);
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

          {/* Subtitle Display */}
          <AnimatePresence>
            {currentCue && activeSubtitleTrack && (
              <SubtitleDisplay cue={currentCue} bottomOffset={140} />
            )}
          </AnimatePresence>

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

          {/* Skip Recap Button */}
          {showSkipRecap && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onClick={(e) => { e.stopPropagation(); skipRecap(); }}
              className="absolute bottom-24 left-6 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-2xl font-bold shadow-lg z-20"
            >
              Skip Recap ⏭️
            </motion.button>
          )}

          {/* Next Episode Prompt with Thumbnail Preview */}
          {showNextEpisode && hasNextEpisode && (
            <div className="absolute bottom-24 right-6 left-6 sm:left-auto sm:w-72 bg-gradient-to-br from-violet-500/95 to-fuchsia-600/95 rounded-2xl overflow-hidden z-20 shadow-xl">
              {/* Episode Thumbnail Preview */}
              {nextEpisodeInfo?.thumbnail && (
                <div className="relative w-full h-20 bg-black/20">
                  <img 
                    src={nextEpisodeInfo.thumbnail} 
                    alt={nextEpisodeInfo.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-violet-500/90 to-transparent" />
                </div>
              )}
              
              <div className="p-4">
                {/* Episode Info */}
                {nextEpisodeInfo && (
                  <div className="mb-2">
                    <p className="text-white/70 text-xs">Up Next</p>
                    <p className="text-white font-bold truncate">
                      Episode {nextEpisodeInfo.episodeNumber} • {nextEpisodeInfo.title}
                    </p>
                  </div>
                )}
                
                {/* Countdown */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/90">Playing in</p>
                  <p className="text-2xl font-bold text-white">{nextEpisodeCountdown}s</p>
                </div>
                
                {/* Binge Mode Toggle */}
                <div className="flex items-center justify-between mb-3 py-2 border-t border-white/20">
                  <span className="text-sm text-white/80">Fast Mode 🚀</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleBingeMode(); }}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative",
                      bingeMode ? "bg-white" : "bg-white/30"
                    )}
                  >
                    <span 
                      className={cn(
                        "absolute top-1 w-4 h-4 rounded-full transition-all",
                        bingeMode ? "left-5 bg-violet-600" : "left-1 bg-white"
                      )}
                    />
                  </button>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setShowNextEpisode(false); }}
                    className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onNextEpisode?.(); }}
                    className="flex-1 bg-white text-violet-600 hover:bg-white/90"
                  >
                    Play Now
                  </Button>
                </div>
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

                    <div className="flex items-center gap-2">
                      {/* Subtitles/CC Button - Kid-friendly */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()} 
                            className={cn(
                              "text-white hover:bg-white/20 h-11 w-11 rounded-xl relative",
                              activeSubtitleTrack && "text-violet-400"
                            )}
                          >
                            <Subtitles className="h-5 w-5" />
                            {activeSubtitleTrack && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-violet-500 rounded-full" />
                            )}
                          </Button>
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

          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-medium hover:from-violet-600 hover:to-fuchsia-700 transition-colors"
          >
            <Home className="h-5 w-5" />
            <span className="hidden sm:inline">Kids Home</span>
          </button>
        </div>
      </div>
    </motion.div>
    </>
  );
};
