import { useState } from 'react';
import { Play, Pause, X, Maximize2, Volume2, VolumeX, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CastDevice, PlaybackState } from '@/hooks/useUniversalCast';
import { cn } from '@/lib/utils';

interface CastMiniPlayerProps {
  device: CastDevice;
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onVolumeChange: (volume: number) => void;
  onStop: () => void;
  onExpand: () => void;
}

export function CastMiniPlayer({
  device,
  playbackState,
  onPlay,
  onPause,
  onVolumeChange,
  onStop,
  onExpand,
}: CastMiniPlayerProps) {
  const [showVolume, setShowVolume] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = playbackState.duration > 0 
    ? (playbackState.playbackTime / playbackState.duration) * 100 
    : 0;

  return (
    <div
      className={cn(
        "fixed z-50 bg-card/95 backdrop-blur-md rounded-lg shadow-2xl border border-border/50 overflow-hidden transition-all duration-200",
        "w-72 hover:shadow-primary/20"
      )}
      style={{ bottom: position.y, right: position.x }}
    >
      {/* Thumbnail/Now Playing */}
      <div className="relative h-24 bg-gradient-to-br from-primary/20 to-background">
        {playbackState.videoThumbnail ? (
          <img 
            src={playbackState.videoThumbnail} 
            alt={playbackState.videoTitle || 'Now playing'}
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tv className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
        
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 hover:bg-destructive/20"
          onClick={onStop}
        >
          <X className="h-3 w-3" />
        </Button>
        
        {/* Expand button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-8 h-6 w-6"
          onClick={onExpand}
        >
          <Maximize2 className="h-3 w-3" />
        </Button>

        {/* Title and device */}
        <div className="absolute bottom-2 left-3 right-3">
          <p className="text-xs font-medium text-foreground truncate">
            {playbackState.videoTitle || 'No media playing'}
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Tv className="h-2.5 w-2.5" />
            {device.name}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted/50 relative">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="p-2 flex items-center gap-2">
        {/* Time */}
        <span className="text-[10px] text-muted-foreground min-w-[60px]">
          {formatTime(playbackState.playbackTime)} / {formatTime(playbackState.duration)}
        </span>

        {/* Play/Pause */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20"
          onClick={playbackState.isPlaying ? onPause : onPlay}
        >
          {playbackState.isPlaying ? (
            <Pause className="h-4 w-4 text-primary" />
          ) : (
            <Play className="h-4 w-4 text-primary ml-0.5" />
          )}
        </Button>

        {/* Volume */}
        <div className="flex items-center gap-1 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowVolume(!showVolume)}
          >
            {playbackState.volume === 0 ? (
              <VolumeX className="h-3 w-3" />
            ) : (
              <Volume2 className="h-3 w-3" />
            )}
          </Button>
          
          {showVolume && (
            <Slider
              value={[playbackState.volume]}
              max={100}
              step={1}
              className="w-16"
              onValueChange={([value]) => onVolumeChange(value)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
