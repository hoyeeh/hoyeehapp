import { Tv, X, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CastSession } from '@/hooks/useCastController';
import { cn } from '@/lib/utils';

interface CastNowPlayingProps {
  session: CastSession | null;
  onDisconnect: () => void;
}

export function CastNowPlaying({ session, onDisconnect }: CastNowPlayingProps) {
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = session?.duration 
    ? ((session.receiverPlaybackTime || session.playbackTime || 0) / session.duration) * 100 
    : 0;

  if (!session?.videoUrl) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <Tv className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="font-medium flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-green-500" />
                  {session?.deviceName || 'Smart TV'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Ready to cast • Select something to watch
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Disconnect" onClick={onDisconnect}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        {/* Thumbnail */}
        {session.videoThumbnail && (
          <div className="aspect-video bg-muted relative">
            <img
              src={session.videoThumbnail}
              alt={session.videoTitle}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}
        
        {/* Progress bar overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{session.videoTitle}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span className={cn(
                'flex items-center gap-1',
                session.receiverIsPlaying && 'text-green-500'
              )}>
                {session.receiverIsPlaying ? 'Playing' : 'Paused'}
              </span>
              <span>•</span>
              <span>
                {formatTime(session.receiverPlaybackTime || session.playbackTime || 0)} / {formatTime(session.duration)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Tv className="h-3 w-3" />
              Casting to {session.deviceName || 'Smart TV'}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Disconnect" onClick={onDisconnect}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
