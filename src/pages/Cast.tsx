import { useState, useEffect } from 'react';
import { Tv, Wifi, WifiOff, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CastPairing } from '@/components/cast/CastPairing';
import { CastRemote } from '@/components/cast/CastRemote';
import { CastNowPlaying } from '@/components/cast/CastNowPlaying';
import { CastContentPicker } from '@/components/cast/CastContentPicker';
import { CastQueueManager } from '@/components/cast/CastQueueManager';
import { CommandInspector } from '@/components/cast/CommandInspector';
import { useCastController } from '@/hooks/useCastController';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PendingVideo {
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
}

export default function Cast() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showDebug, setShowDebug] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<PendingVideo | null>(null);
  
  const {
    session,
    isConnecting,
    isConnected,
    error,
    pairWithCode,
    loadVideo,
    play,
    pause,
    seek,
    setVolume,
    stop,
    addToQueue,
    removeFromQueue,
    updateQueue,
    disconnect,
  } = useCastController();

  // Check for pending video from navigation state
  useEffect(() => {
    const state = location.state as { pendingVideo?: PendingVideo } | null;
    if (state?.pendingVideo) {
      setPendingVideo(state.pendingVideo);
      // Clear the state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Auto-cast pending video when connected
  useEffect(() => {
    if (isConnected && pendingVideo) {
      loadVideo({
        url: pendingVideo.url,
        title: pendingVideo.title,
        thumbnail: pendingVideo.thumbnail,
        duration: pendingVideo.duration,
      });
      toast.success(`Casting "${pendingVideo.title}" to TV`);
      setPendingVideo(null);
    }
  }, [isConnected, pendingVideo, loadVideo]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container flex items-center gap-4 h-14 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Hoyeeh Cast</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-2 text-sm text-green-500">
                <Wifi className="h-4 w-4" />
                <span className="hidden sm:inline">{session?.deviceName || 'Connected'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <WifiOff className="h-4 w-4" />
                <span className="hidden sm:inline">Not connected</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs"
            >
              {showDebug ? 'Hide' : 'Debug'}
            </Button>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-2xl mx-auto">
        {!isConnected ? (
          /* Pairing Screen */
          <CastPairing
            onPair={pairWithCode}
            isConnecting={isConnecting}
            error={error}
          />
        ) : (
          /* Connected Screen */
          <div className="space-y-6">
            {/* Now Playing */}
            <CastNowPlaying
              session={session}
              onDisconnect={disconnect}
            />

            {/* Remote Controls */}
            <CastRemote
              session={session}
              onPlay={play}
              onPause={pause}
              onSeek={seek}
              onVolumeChange={setVolume}
              onStop={stop}
            />

            {/* Tabs for Content and Queue */}
            <Tabs defaultValue="browse" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="browse">Browse</TabsTrigger>
                <TabsTrigger value="queue">
                  Queue {session?.queue?.length ? `(${session.queue.length})` : ''}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="browse" className="mt-4">
                <CastContentPicker
                  onSelectVideo={loadVideo}
                  onAddToQueue={addToQueue}
                />
              </TabsContent>
              
              <TabsContent value="queue" className="mt-4">
                <CastQueueManager
                  queue={session?.queue || []}
                  onPlay={(item) => loadVideo({
                    url: item.url,
                    title: item.title,
                    thumbnail: item.thumbnail,
                    duration: item.duration,
                  })}
                  onRemove={removeFromQueue}
                  onReorder={(newQueue) => updateQueue(newQueue)}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Debug Panel */}
        {showDebug && session && (
          <CommandInspector session={session} />
        )}
      </main>
    </div>
  );
}
