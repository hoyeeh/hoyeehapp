import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  ArrowLeft, SkipBack, SkipForward, Loader2, Settings,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CastButton } from "@/components/player/CastButton";
import { toast } from "sonner";
import { toCdnUrl } from "@/utils/cdnUrl";
import { formatTime } from "@/player/core/utils/time";
import { createShakaAdapter, PlayerAdapter } from "@/player/adapters/playback";

interface DesktopPlayerProps {
  src: string;
  title: string;
  contentId: string;
  episodeId?: string;
  initialProgress?: number;
  onBack: () => void;
  introStartTime?: number;
  introEndTime?: number;
  recapStartTime?: number;
  recapEndTime?: number;
  onEnded?: () => void;
  thumbnail?: string;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const DesktopPlayer = ({
  src,
  title,
  contentId,
  episodeId,
  initialProgress = 0,
  onBack,
  introStartTime = 0,
  introEndTime = 90,
  recapStartTime,
  recapEndTime,
  onEnded,
  thumbnail,
}: DesktopPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mediaError, setMediaError] = useState<{ code: string; message: string } | null>(null);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
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

      // Set up event listeners
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

      adapter.on('error', (err) => {
        setMediaError({ code: err?.code || 'UNKNOWN', message: err?.message || 'Unknown error' });
        setIsBuffering(false);
      });

      adapter.on('volumechange', (data) => {
        setVolume(data?.volume || 0);
        setIsMuted(data?.muted || false);
      });

      // Load the video
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
      if (isPlaying) setShowControls(false);
    }, 3000);
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

  const toggleMute = () => {
    if (!adapterRef.current) return;
    adapterRef.current.setMuted(!isMuted);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!adapterRef.current) return;
    const vol = value[0];
    adapterRef.current.setVolume(vol);
    if (vol > 0 && isMuted) {
      adapterRef.current.setMuted(false);
    }
  };

  const handleSeek = (value: number[]) => {
    if (!adapterRef.current) return;
    adapterRef.current.seek(value[0]);
  };

  const skip = (seconds: number) => {
    if (!adapterRef.current) return;
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
    } else {
      await document.exitFullscreen?.();
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    adapterRef.current?.setPlaybackRate(rate);
    setPlaybackRate(rate);
  };

  if (mediaError) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Video Error</h2>
          <p className="text-muted-foreground mb-4">{mediaError.message}</p>
          <button onClick={onBack} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black"
      onMouseMove={resetControlsTimeout}
      onClick={togglePlay}
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
        </div>
      )}

      {/* Resume Prompt */}
      {showResumePrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20" onClick={(e) => e.stopPropagation()}>
          <div className="bg-card p-8 rounded-2xl text-center max-w-sm">
            <Play className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">Resume watching?</h3>
            <p className="text-muted-foreground mb-6">You stopped at {formatTime(resumeFromTime)}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleStartOver} className="px-4 py-2 bg-muted text-foreground rounded-lg">
                Start Over
              </button>
              <button onClick={handleResume} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip Intro Button */}
      {showSkipIntro && (
        <button
          onClick={(e) => { e.stopPropagation(); skipIntro(); }}
          className="absolute bottom-32 right-8 px-6 py-3 bg-foreground/90 text-background rounded-lg font-semibold hover:bg-foreground transition-colors z-10"
        >
          Skip Intro
        </button>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300 pointer-events-none",
          showControls ? "opacity-100" : "opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient & Controls */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
          <div className="flex items-center justify-between p-4">
            <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="flex items-center gap-2 text-white hover:text-white/80">
              <ArrowLeft className="h-6 w-6" />
              <span className="font-medium">{title}</span>
            </button>
            <div className="flex items-center gap-2">
              <CastButton 
                videoUrl={src} 
                videoTitle={title} 
                videoThumbnail={thumbnail}
                onOpenFullscreen={toggleFullscreen}
              />
            </div>
          </div>
        </div>

        {/* Bottom Gradient & Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 pointer-events-auto">
          {/* Progress Bar */}
          <div className="mb-4">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-white/80">
                {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); skip(-10); }} className="text-white hover:text-white/80">
                <SkipBack className="h-6 w-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); skip(10); }} className="text-white hover:text-white/80">
                <SkipForward className="h-6 w-6" />
              </button>
              <div className="flex items-center gap-2 group">
                <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-white/80">
                  {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                </button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-24 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <span className="text-white/80 text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button onClick={(e) => e.stopPropagation()} className="text-white hover:text-white/80">
                    <Settings className="h-6 w-6" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {PLAYBACK_RATES.map((rate) => (
                    <DropdownMenuItem
                      key={rate}
                      onClick={() => handlePlaybackRateChange(rate)}
                      className={cn(playbackRate === rate && "bg-accent")}
                    >
                      {rate}x
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-white/80">
                {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
