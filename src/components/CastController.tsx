import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, X, Tv } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface CastControllerProps {
  deviceName: string;
  mediaTitle: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onDisconnect: () => void;
  className?: string;
}

export function CastController({
  deviceName,
  mediaTitle,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onDisconnect,
  className,
}: CastControllerProps) {
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn(
      'fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border p-4 z-50',
      'animate-in slide-in-from-bottom duration-300',
      className
    )}>
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-brand/20">
              <Tv className="h-4 w-4 text-brand" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Casting to {deviceName}</p>
              <p className="font-medium text-sm truncate max-w-[200px] sm:max-w-none">{mediaTitle}</p>
            </div>
          </div>
          <button
            onClick={onDisconnect}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title="Stop casting"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={([value]) => onSeek(value)}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onMuteToggle}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <div className="w-24 hidden sm:block">
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={([value]) => onVolumeChange(value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSeek(Math.max(0, currentTime - 10))}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              title="Rewind 10s"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            
            <button
              onClick={isPlaying ? onPause : onPlay}
              className="p-3 rounded-full bg-brand hover:bg-brand/90 transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6 text-primary-foreground" fill="currentColor" />
              ) : (
                <Play className="h-6 w-6 text-primary-foreground ml-0.5" fill="currentColor" />
              )}
            </button>
            
            <button
              onClick={() => onSeek(Math.min(duration, currentTime + 10))}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              title="Forward 10s"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          <div className="w-24 hidden sm:block" />
        </div>
      </div>
    </div>
  );
}
