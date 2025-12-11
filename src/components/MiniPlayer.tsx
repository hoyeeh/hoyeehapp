import { useRef, useEffect, useState } from "react";
import { Play, Pause, X, Maximize2 } from "lucide-react";
import { useMiniPlayer } from "@/contexts/MiniPlayerContext";
import { cn } from "@/lib/utils";
import { toCdnUrl } from "@/utils/cdnUrl";

interface MiniPlayerProps {
  onRestore: (content: any, progress: number) => void;
}

export function MiniPlayer({ onRestore }: MiniPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, restore, close, updateTime, setPlaying } = useMiniPlayer();
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 100 });

  // Sync video time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !state.isActive) return;

    video.currentTime = state.currentTime;
    if (state.isPlaying) {
      video.play().catch(() => {});
    }
  }, [state.isActive]);

  // Track time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      updateTime(video.currentTime);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [updateTime]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const handleRestore = () => {
    const result = restore();
    if (result) {
      onRestore(result.content, result.progress);
    }
  };

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
  };

  const handleDrag = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 180, clientX - 90)),
      y: Math.max(60, Math.min(window.innerHeight - 160, clientY - 50)),
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  if (!state.isActive || !state.content) return null;

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div
      className={cn(
        "fixed z-[100] w-44 rounded-xl overflow-hidden shadow-2xl border border-border/50 bg-background",
        "transition-transform duration-200",
        isDragging && "scale-105"
      )}
      style={{ left: position.x, bottom: position.y }}
      onTouchStart={handleDragStart}
      onTouchMove={handleDrag}
      onTouchEnd={handleDragEnd}
      onMouseDown={handleDragStart}
      onMouseMove={handleDrag}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Video */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={toCdnUrl(state.src)}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        
        {/* Controls overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center"
          >
            {state.isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </button>
          <button
            onClick={handleRestore}
            className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Title */}
      <div className="px-2 py-1.5 bg-card">
        <p className="text-xs font-medium truncate">{state.content.title}</p>
      </div>
    </div>
  );
}
