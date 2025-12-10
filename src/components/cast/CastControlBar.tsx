import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { PlaybackState, CastDevice } from '@/hooks/useUniversalCast';
import { cn } from '@/lib/utils';

interface CastControlBarProps {
  device: CastDevice;
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onStop: () => void;
  onDisconnect: () => void;
}

export function CastControlBar({
  device,
  playbackState,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onStop,
  onDisconnect,
}: CastControlBarProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = playbackState.duration > 0 
    ? (playbackState.playbackTime / playbackState.duration) * 100 
    : 0;

  const handleProgressChange = (value: number[]) => {
    const newTime = (value[0] / 100) * playbackState.duration;
    onSeek(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    onVolumeChange(value[0]);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t z-50">
      <div className="container max-w-4xl mx-auto p-4">
        {/* Now Playing Info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {playbackState.videoThumbnail && (
              <img 
                src={playbackState.videoThumbnail} 
                alt="" 
                className="w-12 h-12 rounded object-cover"
              />
            )}
            <div>
              <p className="font-medium text-sm line-clamp-1">
                {playbackState.videoTitle || 'No media playing'}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Tv className="h-3 w-3" />
                Casting to {device.name}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDisconnect}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress Bar */}
        {playbackState.videoUrl && (
          <div className="mb-3">
            <Slider
              value={[progress]}
              onValueChange={handleProgressChange}
              max={100}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{formatTime(playbackState.playbackTime)}</span>
              <span>{formatTime(playbackState.duration)}</span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSeek(Math.max(0, playbackState.playbackTime - 10))}
              disabled={!playbackState.videoUrl}
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              variant="default"
              size="icon"
              className="h-12 w-12"
              onClick={playbackState.isPlaying ? onPause : onPlay}
              disabled={!playbackState.videoUrl}
            >
              {playbackState.isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSeek(Math.min(playbackState.duration, playbackState.playbackTime + 10))}
              disabled={!playbackState.videoUrl}
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onVolumeChange(playbackState.volume === 0 ? 100 : 0)}
            >
              {playbackState.volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
            <Slider
              value={[playbackState.volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-24"
            />
          </div>

          {/* Stop */}
          {playbackState.videoUrl && (
            <Button variant="outline" size="sm" onClick={onStop}>
              Stop
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}