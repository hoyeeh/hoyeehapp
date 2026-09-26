import { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { CastSession } from '@/hooks/useCastController';
import { cn } from '@/lib/utils';

interface CastRemoteProps {
  session: CastSession | null;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onStop: () => void;
}

export function CastRemote({
  session,
  onPlay,
  onPause,
  onSeek,
  onVolumeChange,
  onStop,
}: CastRemoteProps) {
  const [localTime, setLocalTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [localVolume, setLocalVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  // Sync local time with receiver
  useEffect(() => {
    if (!isSeeking && session) {
      setLocalTime(session.receiverPlaybackTime || session.playbackTime || 0);
    }
  }, [session?.receiverPlaybackTime, session?.playbackTime, isSeeking]);

  // Update local time while playing
  useEffect(() => {
    if (session?.isPlaying && !isSeeking) {
      const interval = setInterval(() => {
        setLocalTime(prev => Math.min(prev + 1, session.duration));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [session?.isPlaying, session?.duration, isSeeking]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeekStart = () => setIsSeeking(true);
  
  const handleSeekEnd = (value: number[]) => {
    setIsSeeking(false);
    onSeek(value[0]);
  };

  const handleVolumeToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      onVolumeChange(localVolume);
    } else {
      setIsMuted(true);
      onVolumeChange(0);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setLocalVolume(newVolume);
    setIsMuted(newVolume === 0);
    onVolumeChange(newVolume);
  };

  const hasVideo = !!session?.videoUrl;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Slider
            value={[isSeeking ? localTime : (session?.receiverPlaybackTime || session?.playbackTime || 0)]}
            max={session?.duration || 100}
            step={1}
            onValueChange={(v) => {
              handleSeekStart();
              setLocalTime(v[0]);
            }}
            onValueCommit={handleSeekEnd}
            disabled={!hasVideo}
            className={cn(!hasVideo && 'opacity-50')}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(localTime)}</span>
            <span>{formatTime(session?.duration || 0)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back 10 seconds"
            onClick={() => onSeek(Math.max(0, localTime - 10))}
            disabled={!hasVideo}
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button
            size="lg"
            className="h-14 w-14 rounded-full"
            aria-label={session?.isPlaying ? 'Pause' : 'Play'}
            onClick={session?.isPlaying ? onPause : onPlay}
            disabled={!hasVideo}
          >
            {session?.isPlaying ? (
              <Pause className="h-6 w-6" fill="currentColor" />
            ) : (
              <Play className="h-6 w-6 ml-0.5" fill="currentColor" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Forward 10 seconds"
            onClick={() => onSeek(Math.min(session?.duration || 0, localTime + 10))}
            disabled={!hasVideo}
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Volume & Stop */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            onClick={handleVolumeToggle}
            disabled={!hasVideo}
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </Button>
          
          <Slider
            value={[isMuted ? 0 : localVolume]}
            max={100}
            step={1}
            onValueChange={handleVolumeChange}
            disabled={!hasVideo}
            className={cn('flex-1', !hasVideo && 'opacity-50')}
          />

          <Button
            variant="ghost"
            size="icon"
            aria-label="Stop"
            onClick={onStop}
            disabled={!hasVideo}
            className="text-destructive hover:text-destructive"
          >
            <Square className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
