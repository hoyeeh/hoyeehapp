import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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

interface UseCastControllerOptions {
  onSessionChange?: (session: CastSession | null) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useCastController(options?: UseCastControllerOptions) {
  const { user } = useAuth();
  const [session, setSession] = useState<CastSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const commandRateLimitRef = useRef<{ [key: string]: number }>({});

  // Rate limit commands (max 10/sec)
  const canSendCommand = useCallback((command: string): boolean => {
    const now = Date.now();
    const key = `${command}-${Math.floor(now / 1000)}`;
    const count = commandRateLimitRef.current[key] || 0;
    
    if (count >= 10) return false;
    commandRateLimitRef.current[key] = count + 1;
    
    // Cleanup old keys
    Object.keys(commandRateLimitRef.current).forEach(k => {
      if (!k.endsWith(`-${Math.floor(now / 1000)}`)) {
        delete commandRateLimitRef.current[k];
      }
    });
    
    return true;
  }, []);

  // Pair with a TV using code
  const pairWithCode = useCallback(async (code: string): Promise<boolean> => {
    if (!user) {
      setError('Please sign in to cast');
      return false;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/cast-signaling?action=pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pairingCode: code.toUpperCase() }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to pair');
        setIsConnecting(false);
        return false;
      }

      // Start listening to session updates
      await setupRealtimeSubscription(result.sessionId);
      
      // Fetch initial session state
      await fetchSessionStatus(result.sessionId);

      setIsConnected(true);
      setIsConnecting(false);
      toast.success(`Connected to ${result.deviceName || 'TV'}`);
      return true;
    } catch (err) {
      console.error('[useCastController] Pair error:', err);
      setError('Connection failed');
      setIsConnecting(false);
      return false;
    }
  }, [user]);

  // Fetch session status
  const fetchSessionStatus = useCallback(async (sessionId: string) => {
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) return;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/cast-signaling?action=status&sessionId=${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (result.success && result.session) {
        const newSession: CastSession = {
          id: result.session.id,
          status: result.session.status,
          deviceName: result.session.deviceName,
          videoUrl: result.session.videoUrl,
          videoTitle: result.session.videoTitle,
          videoThumbnail: result.session.videoThumbnail,
          playbackTime: result.session.playbackTime || 0,
          duration: result.session.duration || 0,
          isPlaying: result.session.isPlaying || false,
          volume: result.session.volume || 100,
          queue: result.session.queue || [],
          commandSeq: result.session.commandSeq || 0,
          commandType: result.session.commandType,
          lastHeartbeat: result.session.lastHeartbeat,
          receiverPlaybackTime: result.session.receiverPlaybackTime,
          receiverIsPlaying: result.session.receiverIsPlaying,
        };
        setSession(newSession);
        options?.onSessionChange?.(newSession);
      }
    } catch (err) {
      console.error('[useCastController] Status fetch error:', err);
    }
  }, [options]);

  // Setup realtime subscription
  const setupRealtimeSubscription = useCallback(async (sessionId: string) => {
    // Cleanup existing subscription
    if (realtimeChannelRef.current) {
      await supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel(`cast-controller-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cast_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const data = payload.new as any;
          const newSession: CastSession = {
            id: data.id,
            status: data.status,
            deviceName: session?.deviceName,
            videoUrl: data.video_url,
            videoTitle: data.video_title,
            videoThumbnail: data.video_thumbnail,
            playbackTime: data.playback_time || 0,
            duration: data.video_duration || 0,
            isPlaying: data.is_playing || false,
            volume: data.volume_level || 100,
            queue: data.queue || [],
            commandSeq: data.command_seq || 0,
            commandType: data.command_type,
            lastHeartbeat: data.last_heartbeat,
            receiverPlaybackTime: data.receiver_playback_time,
            receiverIsPlaying: data.receiver_is_playing,
          };
          setSession(newSession);
          options?.onSessionChange?.(newSession);

          // Handle disconnection
          if (data.status === 'disconnected') {
            setIsConnected(false);
            toast.info('TV disconnected');
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    // Start polling as fallback
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
      fetchSessionStatus(sessionId);
    }, 5000);
  }, [session?.deviceName, options, fetchSessionStatus]);

  // Send command to TV
  const sendCommand = useCallback(async (command: string, payload: Record<string, unknown> = {}) => {
    if (!session?.id) {
      console.warn('[useCastController] No session to send command');
      return false;
    }

    if (!canSendCommand(command)) {
      console.warn('[useCastController] Rate limit exceeded for command:', command);
      return false;
    }

    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/cast-signaling?action=command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: session.id,
          command,
          payload,
        }),
      });

      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error('[useCastController] Command error:', err);
      return false;
    }
  }, [session?.id, canSendCommand]);

  // Load video on TV
  const loadVideo = useCallback(async (video: {
    url: string;
    title: string;
    thumbnail?: string;
    duration?: number;
    startTime?: number;
  }) => {
    return sendCommand('LOAD', {
      videoUrl: video.url,
      title: video.title,
      thumbnail: video.thumbnail,
      duration: video.duration || 0,
      startTime: video.startTime || 0,
    });
  }, [sendCommand]);

  // Playback controls
  const play = useCallback(() => sendCommand('PLAY'), [sendCommand]);
  const pause = useCallback(() => sendCommand('PAUSE'), [sendCommand]);
  const seek = useCallback((time: number) => sendCommand('SEEK', { time }), [sendCommand]);
  const setVolume = useCallback((volume: number) => sendCommand('VOLUME', { volume }), [sendCommand]);
  const stop = useCallback(() => sendCommand('STOP'), [sendCommand]);

  // Queue management
  const updateQueue = useCallback((queue: QueueItem[]) => {
    return sendCommand('UPDATE_QUEUE', { queue });
  }, [sendCommand]);

  const addToQueue = useCallback((item: QueueItem) => {
    const newQueue = [...(session?.queue || []), item];
    return updateQueue(newQueue);
  }, [session?.queue, updateQueue]);

  const removeFromQueue = useCallback((itemId: string) => {
    const newQueue = (session?.queue || []).filter(i => i.id !== itemId);
    return updateQueue(newQueue);
  }, [session?.queue, updateQueue]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (!session?.id) return;

    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;

      await fetch(`${SUPABASE_URL}/functions/v1/cast-signaling?action=disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: session.id }),
      });
    } catch (err) {
      console.error('[useCastController] Disconnect error:', err);
    }

    // Cleanup
    if (realtimeChannelRef.current) {
      await supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    setSession(null);
    setIsConnected(false);
    options?.onSessionChange?.(null);
    toast.info('Disconnected from TV');
  }, [session?.id, options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
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
    updateQueue,
    addToQueue,
    removeFromQueue,
    disconnect,
    sendCommand,
  };
}
