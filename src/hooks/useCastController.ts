import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCast } from '@/contexts/CastContext';
import type { LoadVideoResult } from '@/hooks/useUniversalCast';

/**
 * /cast remote-control page adapter.
 *
 * There is only ONE TV-code protocol path: the app-wide CastContext
 * (useUniversalCast → cast-signaling v2 with controller JWT and exact-seq
 * receiver ACKs). This hook just reshapes that state for the /cast UI.
 */
export interface CastSession {
  id: string;
  status: 'pending' | 'paired' | 'active' | 'disconnected' | 'expired';
  deviceName?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoThumbnail?: string;
  playbackTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  queue: QueueItem[];
  commandSeq: number;
  commandType?: string;
  lastHeartbeat?: string;
  receiverPlaybackTime?: number;
  receiverIsPlaying?: boolean;
}

export interface QueueItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
}

export function useCastController() {
  const { user } = useAuth();
  const cast = useCast();
  const [error, setError] = useState<string | null>(null);

  const session: CastSession | null = useMemo(() => {
    if (!cast.sessionId) return null;
    const p = cast.playbackState;
    return {
      id: cast.sessionId,
      status: p.videoUrl ? 'active' : 'paired',
      deviceName: cast.connectedDevice?.name,
      videoUrl: p.videoUrl ?? undefined,
      videoTitle: p.videoTitle ?? undefined,
      videoThumbnail: p.videoThumbnail ?? undefined,
      playbackTime: p.playbackTime,
      duration: p.duration,
      isPlaying: p.isPlaying,
      volume: p.volume,
      queue: p.queue,
      commandSeq: 0,
      receiverPlaybackTime: p.playbackTime,
      receiverIsPlaying: p.isPlaying,
    };
  }, [cast.sessionId, cast.connectedDevice, cast.playbackState]);

  const pairWithCode = useCallback(async (code: string): Promise<boolean> => {
    if (!user) { setError('Please sign in to cast'); return false; }
    setError(null);
    const id = await cast.pairWithCode(code);
    if (!id) { setError('Invalid or expired code'); return false; }
    return true;
  }, [user, cast.pairWithCode]);

  const loadVideo = useCallback((v: { url: string; title: string; thumbnail?: string; duration?: number; startTime?: number }): Promise<LoadVideoResult> =>
    cast.loadVideo(v.url, v.title, v.thumbnail, v.duration, v.startTime || 0),
  [cast.loadVideo]);

  const updateQueue = useCallback((queue: QueueItem[]) => cast.updateQueue(queue), [cast.updateQueue]);
  const addToQueue = useCallback((item: QueueItem) => updateQueue([...(session?.queue || []), item]), [session?.queue, updateQueue]);
  const removeFromQueue = useCallback((id: string) => updateQueue((session?.queue || []).filter(i => i.id !== id)), [session?.queue, updateQueue]);

  return {
    session,
    isConnecting: cast.isConnecting,
    isConnected: cast.isConnected,
    error,
    pairWithCode,
    loadVideo,
    play: cast.play,
    pause: cast.pause,
    seek: cast.seek,
    setVolume: cast.setVolume,
    stop: cast.stop,
    updateQueue,
    addToQueue,
    removeFromQueue,
    disconnect: cast.disconnect,
  };
}
