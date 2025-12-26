import { 
  CastCommandType, 
  CastCommandTypeValue,
  CastSessionState,
  LoadCommandPayload,
  SeekCommandPayload,
  VolumeCommandPayload,
  parseCastSession,
} from './commandSchema';
import { createRateLimiter } from '../../core/utils/throttle';
import { shouldSeek } from '../../core/utils/time';

export interface CastReceiverOptions {
  onLoad?: (url: string, startTime?: number, title?: string, thumbnail?: string) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onVolume?: (volume: number) => void;
  onStop?: () => void;
  onQueueUpdate?: (queue: any[]) => void;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  // Seek drift threshold - only seek if difference is greater than this
  seekDriftThreshold?: number;
}

export interface CastReceiverInstance {
  // Connection
  initialize(sessionId: string): void;
  disconnect(): void;
  isConnected(): boolean;
  getSession(): CastSessionState | null;
  
  // Heartbeat
  sendHeartbeat(playbackTime: number, isPlaying: boolean): void;
  
  // State
  getLastCommandSeq(): number;
  
  // Cleanup
  destroy(): void;
}

const HEARTBEAT_RATE_LIMIT_MS = 2000; // Send heartbeat max every 2 seconds

/**
 * Create a Cast Receiver instance for processing commands from controllers
 * 
 * CRITICAL: The receiver ONLY acts on command_seq changes.
 * Heartbeat updates (which don't change command_seq) are IGNORED.
 */
export function createCastReceiver(options: CastReceiverOptions): CastReceiverInstance {
  const { 
    onLoad, 
    onPlay, 
    onPause, 
    onSeek, 
    onVolume, 
    onStop, 
    onQueueUpdate,
    onError,
    onConnected,
    onDisconnected,
    seekDriftThreshold = 1.5,
  } = options;

  let session: CastSessionState | null = null;
  let lastProcessedCommandSeq = 0;
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let supabaseClient: any = null;
  let realtimeChannel: any = null;
  
  const heartbeatLimiter = createRateLimiter(HEARTBEAT_RATE_LIMIT_MS);

  const log = (message: string, ...args: unknown[]) => {
    console.log(`[CastReceiver] ${message}`, ...args);
  };

  /**
   * Process a session update - ONLY act on command_seq changes
   */
  const processSessionUpdate = (newSession: CastSessionState) => {
    const previousSession = session;
    session = newSession;

    // CRITICAL: Only process if command_seq has changed
    if (newSession.commandSeq <= lastProcessedCommandSeq) {
      // This is a heartbeat update or duplicate - IGNORE
      return;
    }

    // New command detected
    log('Processing command', {
      type: newSession.commandType,
      seq: newSession.commandSeq,
      previousSeq: lastProcessedCommandSeq,
    });

    lastProcessedCommandSeq = newSession.commandSeq;

    // Execute the command
    switch (newSession.commandType) {
      case CastCommandType.LOAD:
        const loadPayload = newSession.commandPayload as LoadCommandPayload;
        if (loadPayload?.url) {
          onLoad?.(
            loadPayload.url,
            loadPayload.startTime,
            loadPayload.title,
            loadPayload.thumbnail
          );
        }
        break;

      case CastCommandType.PLAY:
        onPlay?.();
        break;

      case CastCommandType.PAUSE:
        onPause?.();
        break;

      case CastCommandType.SEEK:
        const seekPayload = newSession.commandPayload as SeekCommandPayload;
        if (typeof seekPayload?.time === 'number') {
          onSeek?.(seekPayload.time);
        }
        break;

      case CastCommandType.VOLUME:
        const volPayload = newSession.commandPayload as VolumeCommandPayload;
        if (typeof volPayload?.volume === 'number') {
          onVolume?.(volPayload.volume);
        }
        break;

      case CastCommandType.STOP:
        onStop?.();
        break;

      case CastCommandType.QUEUE_UPDATE:
        if (newSession.queue) {
          onQueueUpdate?.(newSession.queue);
        }
        break;

      default:
        log('Unknown command type:', newSession.commandType);
    }
  };

  const setupPolling = (sessionId: string, supabaseUrl: string, anonKey: string) => {
    pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/cast_sessions?id=eq.${sessionId}&select=*`,
          {
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data && data[0]) {
            processSessionUpdate(parseCastSession(data[0]));
          }
        }
      } catch (error) {
        log('Polling error:', error);
      }
    }, 2000);
  };

  const cleanup = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    if (realtimeChannel && supabaseClient) {
      supabaseClient.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };

  const receiver: CastReceiverInstance = {
    initialize(sessionId: string): void {
      log('Initializing receiver for session:', sessionId);

      // Get Supabase config from environment or globals
      const supabaseUrl = (window as any).SUPABASE_URL || 
        import.meta.env?.VITE_SUPABASE_URL ||
        'https://astugmzoxhxcyipxsojl.supabase.co';
      const anonKey = (window as any).SUPABASE_ANON_KEY ||
        import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
        '';

      // Try to use Supabase realtime if available
      if ((window as any).supabase?.createClient) {
        try {
          supabaseClient = (window as any).supabase.createClient(supabaseUrl, anonKey);
          
          realtimeChannel = supabaseClient
            .channel(`cast-receiver-${sessionId}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'cast_sessions',
                filter: `id=eq.${sessionId}`,
              },
              (payload: any) => {
                if (payload.new) {
                  processSessionUpdate(parseCastSession(payload.new));
                }
              }
            )
            .subscribe((status: string) => {
              log('Realtime subscription status:', status);
              if (status === 'SUBSCRIBED') {
                onConnected?.();
              }
            });
        } catch (error) {
          log('Realtime setup failed, falling back to polling:', error);
        }
      }

      // Always set up polling as fallback
      setupPolling(sessionId, supabaseUrl, anonKey);
    },

    disconnect(): void {
      cleanup();
      session = null;
      lastProcessedCommandSeq = 0;
      onDisconnected?.();
    },

    isConnected(): boolean {
      return session !== null;
    },

    getSession(): CastSessionState | null {
      return session;
    },

    /**
     * Send receiver heartbeat - updates ONLY heartbeat fields
     * This does NOT change command_seq and should NOT trigger any actions on re-sync
     */
    sendHeartbeat(playbackTime: number, isPlaying: boolean): void {
      if (!session || !heartbeatLimiter.canExecute()) {
        return;
      }

      // Get Supabase config
      const supabaseUrl = (window as any).SUPABASE_URL || 
        import.meta.env?.VITE_SUPABASE_URL ||
        'https://astugmzoxhxcyipxsojl.supabase.co';
      const anonKey = (window as any).SUPABASE_ANON_KEY ||
        import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
        '';

      // Send heartbeat (fire and forget)
      fetch(`${supabaseUrl}/rest/v1/cast_sessions?id=eq.${session.sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          receiver_playback_time: playbackTime,
          receiver_is_playing: isPlaying,
          receiver_last_heartbeat: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
        }),
      }).catch((error) => {
        log('Heartbeat error:', error);
      });
    },

    getLastCommandSeq(): number {
      return lastProcessedCommandSeq;
    },

    destroy(): void {
      this.disconnect();
    },
  };

  return receiver;
}
