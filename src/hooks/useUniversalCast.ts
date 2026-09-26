import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { castLog } from '@/lib/castLog';
import { CastAckTracker } from '@/lib/castAckTracker';
import { castMediaOptions, getReceiverMediaIssue } from '@/lib/castMedia';

// How long the controller waits for the TV receiver to send an ack
// (success or error) after a LOAD command. After this expires we
// surface a "TV failed to load" failure state with retry.
const LOAD_ACK_TIMEOUT_MS = 8000;

export interface LoadVideoResult {
  success: boolean;
  error?: string;
  /** The command_seq assigned to this LOAD by the signaling server. */
  seq?: number;
  /** Whether the receiver acknowledged the LOAD within the timeout. */
  acked?: boolean;
  /** True when the LOAD was sent successfully but no ack arrived in time. */
  timedOut?: boolean;
  /** A newer command replaced this LOAD before the TV confirmed it. */
  superseded?: boolean;
}

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
  const ackTrackerRef = useRef(new CastAckTracker(15000));
  const callSignalingRef = useRef<(a: string, b?: Record<string, unknown>) => Promise<any>>(async () => ({ success: false }));

  // Load paired devices from local storage
  const devicesKey = user?.id ? `hoyeeh_paired_devices:${user.id}` : null;
  const devicesKeyRef = useRef<string | null>(devicesKey);
  devicesKeyRef.current = devicesKey;
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Legacy un-scoped list could leak across accounts on shared devices.
    localStorage.removeItem('hoyeeh_paired_devices');
    let devices: CastDevice[] = [];
    if (devicesKey) {
      try { devices = JSON.parse(localStorage.getItem(devicesKey) || '[]'); } catch { devices = []; }
    }
    const uid = user?.id ?? null;
    const switched = prevUserIdRef.current !== undefined && prevUserIdRef.current !== uid;
    prevUserIdRef.current = uid;
    if (switched) {
      // Logout / account switch: drop the live session locally; the old
      // account's ownership is enforced server-side.
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      if (realtimeChannelRef.current) { supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; }
      ackTrackerRef.current.cancelAll('Signed out');
      sessionIdRef.current = null;
      setState(prev => ({ ...prev, connectedDevice: null, sessionId: null, playbackState: initialPlaybackState, pairedDevices: devices }));
    } else {
      setState(prev => ({ ...prev, pairedDevices: devices }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devicesKey]);

  // Save paired devices
  const savePairedDevice = useCallback((device: CastDevice) => {
    setState(prev => {
      // Re-pairing the same TV must refresh its sessionId, otherwise
      // "reconnect" would keep using a dead session.
      const newDevices = [...prev.pairedDevices.filter(d => d.id !== device.id), device];
      if (devicesKeyRef.current) localStorage.setItem(devicesKeyRef.current, JSON.stringify(newDevices));
      return { ...prev, pairedDevices: newDevices };
    });
  }, []);

  // Remove paired device
  const removePairedDevice = useCallback((deviceId: string) => {
    setState(prev => {
      const newDevices = prev.pairedDevices.filter(d => d.id !== deviceId);
      if (devicesKeyRef.current) localStorage.setItem(devicesKeyRef.current, JSON.stringify(newDevices));
      return { ...prev, pairedDevices: newDevices };
    });
  }, []);

  // Call signaling backend function
  const callSignaling = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cast-signaling`);
      url.searchParams.set('action', action);

      // Status expects sessionId as a query param (receiver uses this too)
      const sessionId = typeof body.sessionId === 'string' ? (body.sessionId as string) : undefined;
      if (action === 'status' && sessionId) {
        url.searchParams.set('sessionId', sessionId);
      }

      // Auth: required for pairing/commands. Include user access token when available.
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      // If action likely requires auth and user isn't signed in, fail fast.
      if (!accessToken && (action === 'pair' || action === 'command' || action === 'disconnect' || action === 'status')) {
        return { success: false, error: 'Please sign in to cast to TV.' };
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);

      try {
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: Object.keys(body).length ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        const json = await res.json().catch(() => ({ success: false, error: 'Invalid response from server' }));
        if (!res.ok && (json as any)?.error == null) {
          (json as any).error = `Request failed (${res.status})`;
        }
        return json;
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          return { success: false, error: 'Connection timed out. Please try again.' };
        }
        return { success: false, error: 'Network error. Please try again.' };
      } finally {
        window.clearTimeout(timeout);
      }
    },
    []
  );


  callSignalingRef.current = callSignaling;

  // Session ID ref for immediate access after pairing
  const sessionIdRef = useRef<string | null>(null);

  // Pair with TV using code - returns sessionId on success for immediate use
  const pairWithCode = useCallback(async (code: string): Promise<string | null> => {
    setState(prev => ({ ...prev, isConnecting: true }));
    castLog.info('Pair attempt', { code: code.toUpperCase() });

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

        sessionIdRef.current = result.sessionId;

        setState(prev => ({
          ...prev,
          isConnecting: false,
          connectedDevice: device,
          sessionId: result.sessionId,
        }));

        savePairedDevice(device);
        startPolling(result.sessionId);
        setupRealtimeSubscription(result.sessionId);

        castLog.success('Pair success', { sessionId: result.sessionId, device: device.name });
        toast.success(`Connected to ${device.name}`);
        return result.sessionId;
      } else {
        castLog.error('Pair failed', { error: result.error });
        toast.error(result.error || 'Invalid or expired code');
        setState(prev => ({ ...prev, isConnecting: false }));
        return null;
      }
    } catch (error: any) {
      castLog.error('Pair threw', { error: String(error?.message || error) });
      console.error('Pairing error:', error);
      toast.error('Failed to connect');
      setState(prev => ({ ...prev, isConnecting: false }));
      return null;
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
      const result = await callSignaling('status', { sessionId: device.sessionId });

      if (result.success && (result.session.status === 'paired' || result.session.status === 'active')) {
        sessionIdRef.current = device.sessionId!;
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
  }, [removePairedDevice, callSignaling]);

  // Reference to disconnect function for use in polling
  const disconnectRef = useRef<() => void>(() => {});

  // Start polling for session updates (reduced frequency as realtime is primary)
  const startPolling = useCallback((sessionId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Polling is now a fallback - realtime is primary
    // Poll every 10 seconds instead of 2 to reduce load
    let lastPoll = 0;
    pollIntervalRef.current = setInterval(async () => {
      // Fast poll while waiting on an ACK (realtime may be unavailable), else slow.
      const interval = ackTrackerRef.current.pendingCount > 0 ? 1500 : 10000;
      if (Date.now() - lastPoll < interval) return;
      lastPoll = Date.now();
      try {
        const result = await callSignalingRef.current('status', { sessionId });

        if (!result.success && (result.error === 'Not authorized' || result.error === 'Authentication required')) {
          disconnectRef.current();
          return;
        }
        if (result.success) {
          ackTrackerRef.current.observe({
            lastAckedSeq: result.session.lastAckedSeq,
            lastAckStatus: result.session.lastAckStatus,
            lastAckError: result.session.lastAckError,
            commandSeq: result.session.commandSeq,
          });
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

          if (result.session.status === 'disconnected' || result.session.status === 'expired') {
            disconnectRef.current();
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 500);
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

          // Resolve any pending ack waiters when the receiver posts an ack.
          ackTrackerRef.current.observe({
            lastAckedSeq: Number(session.last_acked_seq) || 0,
            lastAckStatus: (session.last_ack_status as string | null) ?? null,
            lastAckError: (session.last_ack_error as string | null) ?? null,
            commandSeq: Number(session.command_seq) || 0,
          });
        }
      )
      .subscribe();
  }, []);

  // Send command to receiver - uses ref for immediate sessionId access
  const sendCommand = useCallback(async (
    command: string,
    payload: Record<string, unknown> = {},
    overrideSessionId?: string
  ) => {
    const activeSessionId = overrideSessionId || sessionIdRef.current || state.sessionId;
    if (!activeSessionId) {
      castLog.error(`Cannot send ${command}: no active session`);
      return { success: false, error: 'No active session' };
    }

    castLog.info(`Send command ${command}`, { sessionId: activeSessionId, payload });
    try {
      const result = await callSignaling('command', {
        sessionId: activeSessionId,
        command,
        payload,
      });
      if (result?.success) {
        castLog.success(`Command ${command} accepted by server`, { seq: result.seq });
      } else {
        castLog.error(`Command ${command} rejected`, { error: result?.error });
      }
      return result;
    } catch (error: any) {
      castLog.error(`Command ${command} threw`, { error: String(error?.message || error) });
      toast.error('Failed to send command');
      return { success: false, error: 'Command failed' };
    }
  }, [state.sessionId, callSignaling]);

  // Load video on receiver — sends LOAD then waits for the TV ack handshake.
  const loadVideo = useCallback(async (
    videoUrl: string,
    title: string,
    thumbnail?: string,
    duration?: number,
    startTime?: number,
    overrideSessionId?: string
  ): Promise<LoadVideoResult> => {
    const mediaIssue = getReceiverMediaIssue(videoUrl, castMediaOptions());
    if (mediaIssue) {
      castLog.error('LOAD blocked: media not reachable by receiver', { url: videoUrl });
      toast.error(mediaIssue);
      return { success: false, error: mediaIssue };
    }
    castLog.info('LOAD payload prepared', { url: videoUrl, title, startTime: startTime || 0, sessionId: overrideSessionId });

    const result = await sendCommand('LOAD', {
      url: videoUrl,
      videoUrl,
      title,
      thumbnail,
      duration,
      startTime: startTime || 0,
    }, overrideSessionId);

    if (!result?.success) {
      const errorMessage = typeof result?.error === 'string' ? result.error : 'Failed to launch video on TV';
      castLog.error('LOAD rejected by server', { error: errorMessage });
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }

    // Wait for the TV receiver to acknowledge it actually loaded the stream.
    const seq = typeof result.seq === 'number' ? result.seq : undefined;
    if (seq === undefined) {
      // Without a seq we cannot correlate a receiver ACK — never report success.
      castLog.error('LOAD accepted but server returned no seq');
      toast.error('TV did not confirm playback');
      return { success: false, acked: false, error: 'TV did not confirm playback' };
    }

    const ack = await ackTrackerRef.current.wait(seq);
    if (ack.acked) {
      return { success: true, acked: true, seq };
    }
    if (ack.superseded) {
      return { success: false, acked: false, superseded: true, seq, error: ack.error };
    }

    const message = ack.error || 'TV failed to load the video';
    castLog.error('LOAD did not complete on TV', { seq, timedOut: ack.timedOut, error: message });
    toast.error(message);
    return { success: false, acked: false, timedOut: !!ack.timedOut, seq, error: message };
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

    sessionIdRef.current = null;
    ackTrackerRef.current.cancelAll();

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