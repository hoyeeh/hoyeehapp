import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface CastDevice {
  id: string;
  name: string;
  type: 'remote' | 'dlna' | 'chromecast';
  sessionId?: string;
  ip?: string;
  port?: number;
}

export interface PlaybackState {
  videoUrl: string | null;
  videoTitle: string | null;
  videoThumbnail: string | null;
  playbackTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  queue: QueueItem[];
}

export interface QueueItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
}

interface UniversalCastState {
  isConnecting: boolean;
  connectedDevice: CastDevice | null;
  sessionId: string | null;
  playbackState: PlaybackState;
  pairedDevices: CastDevice[];
}

const initialPlaybackState: PlaybackState = {
  videoUrl: null,
  videoTitle: null,
  videoThumbnail: null,
  playbackTime: 0,
  duration: 0,
  isPlaying: false,
  volume: 100,
  queue: [],
};

export function useUniversalCast() {
  const { user } = useAuth();
  const [state, setState] = useState<UniversalCastState>({
    isConnecting: false,
    connectedDevice: null,
    sessionId: null,
    playbackState: initialPlaybackState,
    pairedDevices: [],
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load paired devices from local storage
  useEffect(() => {
    const saved = localStorage.getItem('hoyeeh_paired_devices');
    if (saved) {
      try {
        const devices = JSON.parse(saved);
        setState(prev => ({ ...prev, pairedDevices: devices }));
      } catch (e) {
        console.error('Error loading paired devices:', e);
      }
    }
  }, []);

  // Save paired devices
  const savePairedDevice = useCallback((device: CastDevice) => {
    setState(prev => {
      const exists = prev.pairedDevices.find(d => d.id === device.id);
      if (exists) return prev;

      const newDevices = [...prev.pairedDevices, device];
      localStorage.setItem('hoyeeh_paired_devices', JSON.stringify(newDevices));
      return { ...prev, pairedDevices: newDevices };
    });
  }, []);

  // Remove paired device
  const removePairedDevice = useCallback((deviceId: string) => {
    setState(prev => {
      const newDevices = prev.pairedDevices.filter(d => d.id !== deviceId);
      localStorage.setItem('hoyeeh_paired_devices', JSON.stringify(newDevices));
      return { ...prev, pairedDevices: newDevices };
    });
  }, []);

  // Call signaling edge function
  const callSignaling = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const response = await supabase.functions.invoke('cast-signaling', {
      body,
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    // Handle the query param by modifying the request
    if (action === 'status' && body.sessionId) {
      const { data, error } = await supabase.functions.invoke('cast-signaling?action=status&sessionId=' + body.sessionId, {
        method: 'POST',
        body: {},
      });
      return data;
    }

    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cast-signaling`);
    url.searchParams.set('action', action);

    const fetchResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    return fetchResponse.json();
  }, []);

  // Pair with TV using code
  const pairWithCode = useCallback(async (code: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      const result = await callSignaling('pair', {
        pairingCode: code.toUpperCase(),
        userId: user?.id,
      });

      if (result.success) {
        const device: CastDevice = {
          id: result.receiverId,
          name: result.deviceName || 'Smart TV',
          type: 'remote',
          sessionId: result.sessionId,
        };

        setState(prev => ({
          ...prev,
          isConnecting: false,
          connectedDevice: device,
          sessionId: result.sessionId,
        }));

        savePairedDevice(device);
        startPolling(result.sessionId);
        setupRealtimeSubscription(result.sessionId);

        toast.success(`Connected to ${device.name}`);
        return true;
      } else {
        toast.error(result.error || 'Invalid or expired code');
        setState(prev => ({ ...prev, isConnecting: false }));
        return false;
      }
    } catch (error) {
      console.error('Pairing error:', error);
      toast.error('Failed to connect');
      setState(prev => ({ ...prev, isConnecting: false }));
      return false;
    }
  }, [user, callSignaling, savePairedDevice]);

  // Reconnect to previously paired device
  const reconnectToDevice = useCallback(async (device: CastDevice): Promise<boolean> => {
    if (!device.sessionId) {
      toast.error('No session found for this device');
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true }));

    try {
      // Check if session is still valid
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cast-signaling?action=status&sessionId=${device.sessionId}`;
      const response = await fetch(url, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const result = await response.json();

      if (result.success && result.session.status !== 'disconnected') {
        setState(prev => ({
          ...prev,
          isConnecting: false,
          connectedDevice: device,
          sessionId: device.sessionId!,
          playbackState: {
            videoUrl: result.session.videoUrl,
            videoTitle: result.session.videoTitle,
            videoThumbnail: result.session.videoThumbnail,
            playbackTime: result.session.playbackTime || 0,
            duration: result.session.duration || 0,
            isPlaying: result.session.isPlaying || false,
            volume: result.session.volume || 100,
            queue: result.session.queue || [],
          },
        }));

        startPolling(device.sessionId!);
        setupRealtimeSubscription(device.sessionId!);

        toast.success(`Reconnected to ${device.name}`);
        return true;
      } else {
        // Session expired, remove from paired devices
        removePairedDevice(device.id);
        toast.error('Session expired. Please pair again.');
        setState(prev => ({ ...prev, isConnecting: false }));
        return false;
      }
    } catch (error) {
      console.error('Reconnect error:', error);
      toast.error('Failed to reconnect');
      setState(prev => ({ ...prev, isConnecting: false }));
      return false;
    }
  }, [removePairedDevice]);

  // Reference to disconnect function for use in polling
  const disconnectRef = useRef<() => void>(() => {});

  // Start polling for session updates
  const startPolling = useCallback((sessionId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cast-signaling?action=status&sessionId=${sessionId}`;
        const response = await fetch(url, {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        const result = await response.json();

        if (result.success) {
          setState(prev => ({
            ...prev,
            playbackState: {
              videoUrl: result.session.videoUrl,
              videoTitle: result.session.videoTitle,
              videoThumbnail: result.session.videoThumbnail,
              playbackTime: result.session.playbackTime || 0,
              duration: result.session.duration || 0,
              isPlaying: result.session.isPlaying || false,
              volume: result.session.volume || 100,
              queue: result.session.queue || [],
            },
          }));

          if (result.session.status === 'disconnected') {
            disconnectRef.current();
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  }, []);

  // Setup realtime subscription for instant updates
  const setupRealtimeSubscription = useCallback((sessionId: string) => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    realtimeChannelRef.current = supabase
      .channel(`cast-session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cast_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const session = payload.new as Record<string, unknown>;
          setState(prev => ({
            ...prev,
            playbackState: {
              videoUrl: session.video_url as string | null,
              videoTitle: session.video_title as string | null,
              videoThumbnail: session.video_thumbnail as string | null,
              playbackTime: (session.playback_time as number) || 0,
              duration: (session.video_duration as number) || 0,
              isPlaying: (session.is_playing as boolean) || false,
              volume: (session.volume_level as number) || 100,
              queue: (session.queue as QueueItem[]) || [],
            },
          }));
        }
      )
      .subscribe();
  }, []);

  // Send command to receiver
  const sendCommand = useCallback(async (
    command: string,
    payload: Record<string, unknown> = {}
  ) => {
    if (!state.sessionId) {
      console.error('No active session');
      return;
    }

    try {
      await callSignaling('command', {
        sessionId: state.sessionId,
        command,
        payload,
      });
    } catch (error) {
      console.error('Command error:', error);
      toast.error('Failed to send command');
    }
  }, [state.sessionId, callSignaling]);

  // Load video on receiver
  const loadVideo = useCallback(async (
    videoUrl: string,
    title: string,
    thumbnail?: string,
    duration?: number,
    startTime?: number
  ) => {
    await sendCommand('LOAD', {
      videoUrl,
      title,
      thumbnail,
      duration,
      startTime: startTime || 0,
    });
  }, [sendCommand]);

  // Playback controls
  const play = useCallback(() => sendCommand('PLAY'), [sendCommand]);
  const pause = useCallback(() => sendCommand('PAUSE'), [sendCommand]);
  const seek = useCallback((time: number) => sendCommand('SEEK', { time }), [sendCommand]);
  const setVolume = useCallback((volume: number) => sendCommand('VOLUME', { volume }), [sendCommand]);
  const stop = useCallback(() => sendCommand('STOP'), [sendCommand]);

  // Update queue
  const updateQueue = useCallback((queue: QueueItem[]) => {
    sendCommand('UPDATE_QUEUE', { queue });
  }, [sendCommand]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    if (state.sessionId) {
      try {
        await callSignaling('disconnect', { sessionId: state.sessionId });
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }

    setState(prev => ({
      ...prev,
      connectedDevice: null,
      sessionId: null,
      playbackState: initialPlaybackState,
    }));

    toast.info('Disconnected from TV');
  }, [state.sessionId, callSignaling]);

  // Keep disconnectRef in sync with disconnect function
  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, []);

  return {
    // State
    isConnecting: state.isConnecting,
    isConnected: !!state.connectedDevice,
    connectedDevice: state.connectedDevice,
    sessionId: state.sessionId,
    playbackState: state.playbackState,
    pairedDevices: state.pairedDevices,

    // Connection methods
    pairWithCode,
    reconnectToDevice,
    disconnect,
    removePairedDevice,

    // Playback methods
    loadVideo,
    play,
    pause,
    seek,
    setVolume,
    stop,
    updateQueue,
  };
}