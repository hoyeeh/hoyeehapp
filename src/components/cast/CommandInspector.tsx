import { Bug, Wifi, WifiOff, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CastSession } from '@/hooks/useCastController';
import { cn } from '@/lib/utils';

interface CommandInspectorProps {
  session: CastSession;
}

export function CommandInspector({ session }: CommandInspectorProps) {
  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  const getHeartbeatStatus = () => {
    if (!session.lastHeartbeat) return { status: 'unknown', color: 'text-muted-foreground' };
    const lastBeat = new Date(session.lastHeartbeat).getTime();
    const now = Date.now();
    const diff = now - lastBeat;
    
    if (diff < 5000) return { status: 'healthy', color: 'text-green-500' };
    if (diff < 15000) return { status: 'stale', color: 'text-yellow-500' };
    return { status: 'offline', color: 'text-red-500' };
  };

  const heartbeat = getHeartbeatStatus();

  return (
    <Card className="mt-6 bg-muted/30 border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bug className="h-4 w-4" />
          Debug Info
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs font-mono space-y-3">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Connection</span>
          <span className={cn('flex items-center gap-1', heartbeat.color)}>
            {heartbeat.status === 'healthy' ? (
              <Wifi className="h-3 w-3" />
            ) : heartbeat.status === 'offline' ? (
              <WifiOff className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {heartbeat.status}
          </span>
        </div>

        {/* Session Info */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Session ID</span>
            <span className="truncate max-w-[150px]">{session.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span>{session.status}</span>
          </div>
        </div>

        {/* Command Tracking */}
        <div className="pt-2 border-t border-border/50 space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">command_seq</span>
            <span className="text-primary font-bold">{session.commandSeq}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">command_type</span>
            <span>{session.commandType || 'none'}</span>
          </div>
        </div>

        {/* Playback State */}
        <div className="pt-2 border-t border-border/50 space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">receiverTime</span>
            <span>{session.receiverPlaybackTime?.toFixed(1) || 0}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">receiverPlaying</span>
            <span>{session.receiverIsPlaying ? 'true' : 'false'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">lastHeartbeat</span>
            <span>{formatTime(session.lastHeartbeat)}</span>
          </div>
        </div>

        {/* Video Info */}
        {session.videoUrl && (
          <div className="pt-2 border-t border-border/50 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">videoUrl</span>
              <span className="truncate max-w-[150px]" title={session.videoUrl}>
                ...{session.videoUrl.slice(-30)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
