import { supabase } from '@/integrations/supabase/client';
import { 
  CastCommandType, 
  CastCommandTypeValue, 
  CastCommandPayload,
  CastSessionState,
  LoadCommandPayload,
  SeekCommandPayload,
  VolumeCommandPayload,
  QueueItem,
  parseCastSession,
  validateCommand,
} from './commandSchema';
import { createRateLimiter } from '../../core/utils/throttle';

export interface CastControllerOptions {
  onSessionUpdate?: (session: CastSessionState) => void;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export interface CastControllerInstance {
  // Connection
  pairWithCode(code: string): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  getSession(): CastSessionState | null;
  
  // Commands
  loadVideo(url: string, title?: string, thumbnail?: string, startTime?: number): Promise<boolean>;
  play(): Promise<boolean>;
  pause(): Promise<boolean>;
  seek(time: number): Promise<boolean>;
  setVolume(volume: number): Promise<boolean>;
  stop(): Promise<boolean>;
  
  // Queue
  updateQueue(queue: QueueItem[]): Promise<boolean>;
  addToQueue(item: QueueItem): Promise<boolean>;
  removeFromQueue(itemId: string): Promise<boolean>;
  
  // Cleanup
  destroy(): void;
}

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cast-signaling`;
const COMMAND_RATE_LIMIT_MS = 200; // Max ~5 commands per second

/**
 * Create a Cast Controller instance for sending commands to TV receivers
 */
export function createCastController(options: CastControllerOptions = {}): CastControllerInstance {
  const { onSessionUpdate, onError, onConnected, onDisconnected } = options;
  
  let session: CastSessionState | null = null;
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  
  const commandLimiter = createRateLimiter(COMMAND_RATE_LIMIT_MS);

  const callSignaling = async (
    action: string, 
    body?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const url = `${EDGE_FUNCTION_URL}?action=${action}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      const data = await response.json();
      if (data.error) {
        return { success: false, error: data.error };
      }
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error';
      return { success: false, error: message };
    }
  };

  const sendCommand = async (
    type: CastCommandTypeValue,
    payload: CastCommandPayload = {}
  ): Promise<boolean> => {
    if (!session) {
      onError?.('Not connected to a TV');
      return false;
    }

    // Rate limit commands
    if (!commandLimiter.canExecute()) {
      console.log('[CastController] Command rate limited:', type);
      return false;
    }

    // Validate command
    const validation = validateCommand(type, payload);
    if (!validation.valid) {
      onError?.(validation.error || 'Invalid command');
      return false;
    }

    const result = await callSignaling('command', {
      sessionId: session.sessionId,
      commandType: type,
      commandPayload: payload,
    });

    if (!result.success) {
      onError?.(result.error || 'Failed to send command');
      return false;
    }

    return true;
  };

  const setupRealtimeSubscription = (sessionId: string) => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase
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
          if (payload.new) {
            session = parseCastSession(payload.new as Record<string, unknown>);
            onSessionUpdate?.(session);
          }
        }
      )
      .subscribe();
  };

  const startPolling = (sessionId: string) => {
    // Fallback polling in case realtime doesn't work
    pollingInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from('cast_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!error && data) {
        session = parseCastSession(data as Record<string, unknown>);
        onSessionUpdate?.(session);
      }
    }, 3000);
  };

  const startHeartbeat = (sessionId: string) => {
    heartbeatInterval = setInterval(async () => {
      if (!session) return;
      
      await supabase
        .from('cast_sessions')
        .update({ controller_last_heartbeat: new Date().toISOString() })
        .eq('id', sessionId);
    }, 5000);
  };

  const cleanup = () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  const controller: CastControllerInstance = {
    async pairWithCode(code: string): Promise<boolean> {
      const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      if (normalizedCode.length !== 6) {
        onError?.('Invalid pairing code');
        return false;
      }

      const result = await callSignaling('pair', { code: normalizedCode });
      
      if (!result.success) {
        onError?.(result.error || 'Failed to pair');
        return false;
      }

      session = parseCastSession(result.data.session);
      
      // Set up realtime and polling
      setupRealtimeSubscription(session.sessionId);
      startPolling(session.sessionId);
      startHeartbeat(session.sessionId);
      
      onConnected?.();
      onSessionUpdate?.(session);
      
      return true;
    },

    disconnect(): void {
      if (session) {
        // Send disconnect command
        callSignaling('command', {
          sessionId: session.sessionId,
          commandType: CastCommandType.STOP,
          commandPayload: {},
        });
      }
      
      cleanup();
      session = null;
      onDisconnected?.();
    },

    isConnected(): boolean {
      return session !== null && session.status === 'paired';
    },

    getSession(): CastSessionState | null {
      return session;
    },

    async loadVideo(
      url: string, 
      title?: string, 
      thumbnail?: string, 
      startTime?: number
    ): Promise<boolean> {
      const payload: LoadCommandPayload = {
        url,
        title,
        thumbnail,
        startTime,
      };
      return sendCommand(CastCommandType.LOAD, payload);
    },

    async play(): Promise<boolean> {
      return sendCommand(CastCommandType.PLAY);
    },

    async pause(): Promise<boolean> {
      return sendCommand(CastCommandType.PAUSE);
    },

    async seek(time: number): Promise<boolean> {
      const payload: SeekCommandPayload = { time };
      return sendCommand(CastCommandType.SEEK, payload);
    },

    async setVolume(volume: number): Promise<boolean> {
      const payload: VolumeCommandPayload = { volume };
      return sendCommand(CastCommandType.VOLUME, payload);
    },

    async stop(): Promise<boolean> {
      return sendCommand(CastCommandType.STOP);
    },

    async updateQueue(queue: QueueItem[]): Promise<boolean> {
      return sendCommand(CastCommandType.QUEUE_UPDATE, { queue });
    },

    async addToQueue(item: QueueItem): Promise<boolean> {
      return sendCommand(CastCommandType.ADD_TO_QUEUE, { item });
    },

    async removeFromQueue(itemId: string): Promise<boolean> {
      return sendCommand(CastCommandType.REMOVE_FROM_QUEUE, { itemId });
    },

    destroy(): void {
      this.disconnect();
    },
  };

  return controller;
}
