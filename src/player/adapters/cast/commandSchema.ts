// Command types for Cast communication
export const CastCommandType = {
  LOAD: 'LOAD',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  SEEK: 'SEEK',
  VOLUME: 'VOLUME',
  STOP: 'STOP',
  QUEUE_UPDATE: 'QUEUE_UPDATE',
  ADD_TO_QUEUE: 'ADD_TO_QUEUE',
  REMOVE_FROM_QUEUE: 'REMOVE_FROM_QUEUE',
} as const;

export type CastCommandTypeValue = typeof CastCommandType[keyof typeof CastCommandType];

export interface LoadCommandPayload {
  url: string;
  title?: string;
  thumbnail?: string;
  startTime?: number;
  duration?: number;
  kidsMode?: boolean;
}

export interface SeekCommandPayload {
  time: number;
}

export interface VolumeCommandPayload {
  volume: number; // 0-100
  muted?: boolean;
}

export interface QueueItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
}

export interface QueueUpdatePayload {
  queue: QueueItem[];
  currentIndex?: number;
}

export interface AddToQueuePayload {
  item: QueueItem;
}

export interface RemoveFromQueuePayload {
  itemId: string;
}

export type CastCommandPayload = 
  | LoadCommandPayload
  | SeekCommandPayload
  | VolumeCommandPayload
  | QueueUpdatePayload
  | AddToQueuePayload
  | RemoveFromQueuePayload
  | Record<string, never>; // Empty payload for PLAY, PAUSE, STOP

export interface CastCommand {
  type: CastCommandTypeValue;
  payload: CastCommandPayload;
  seq: number;
  timestamp: number;
}

export interface CastSessionState {
  sessionId: string;
  pairingCode: string;
  status: 'pending' | 'paired' | 'active' | 'disconnected';
  
  // Command state (only changes on commands)
  commandSeq: number;
  commandType: CastCommandTypeValue | null;
  commandPayload: CastCommandPayload | null;
  commandUpdatedAt: string | null;
  
  // Receiver heartbeat state (changes frequently, NOT commands)
  receiverPlaybackTime: number;
  receiverIsPlaying: boolean;
  receiverLastHeartbeat: string | null;
  
  // Controller heartbeat
  controllerLastHeartbeat: string | null;
  
  // Media state (updated with LOAD commands)
  videoUrl: string | null;
  videoTitle: string | null;
  videoThumbnail: string | null;
  videoDuration: number | null;
  volumeLevel: number;
  
  // Queue
  queue: QueueItem[];
  currentQueueIndex: number;
}

/**
 * Parse a cast session from Supabase row
 */
export function parseCastSession(row: Record<string, unknown>): CastSessionState {
  return {
    sessionId: row.id as string,
    pairingCode: row.pairing_code as string,
    status: (row.status as string) as CastSessionState['status'],
    
    commandSeq: (row.command_seq as number) || 0,
    commandType: row.command_type as CastCommandTypeValue | null,
    commandPayload: row.command_payload as CastCommandPayload | null,
    commandUpdatedAt: row.command_updated_at as string | null,
    
    receiverPlaybackTime: (row.receiver_playback_time as number) || 0,
    receiverIsPlaying: Boolean(row.receiver_is_playing),
    receiverLastHeartbeat: row.receiver_last_heartbeat as string | null,
    
    controllerLastHeartbeat: row.controller_last_heartbeat as string | null,
    
    videoUrl: row.video_url as string | null,
    videoTitle: row.video_title as string | null,
    videoThumbnail: row.video_thumbnail as string | null,
    videoDuration: row.video_duration as number | null,
    volumeLevel: (row.volume_level as number) || 100,
    
    queue: parseQueue(row.queue),
    currentQueueIndex: 0,
  };
}

function parseQueue(raw: unknown): QueueItem[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    url: item.url as string,
    title: item.title as string,
    thumbnail: item.thumbnail as string | undefined,
    duration: item.duration as number | undefined,
  }));
}

/**
 * Validate a command before sending
 */
export function validateCommand(
  type: CastCommandTypeValue,
  payload: CastCommandPayload
): { valid: boolean; error?: string } {
  switch (type) {
    case CastCommandType.LOAD:
      const loadPayload = payload as LoadCommandPayload;
      if (!loadPayload.url) {
        return { valid: false, error: 'LOAD command requires a URL' };
      }
      break;
    case CastCommandType.SEEK:
      const seekPayload = payload as SeekCommandPayload;
      if (typeof seekPayload.time !== 'number' || seekPayload.time < 0) {
        return { valid: false, error: 'SEEK command requires a valid time' };
      }
      break;
    case CastCommandType.VOLUME:
      const volPayload = payload as VolumeCommandPayload;
      if (typeof volPayload.volume !== 'number' || volPayload.volume < 0 || volPayload.volume > 100) {
        return { valid: false, error: 'VOLUME command requires a volume between 0-100' };
      }
      break;
  }
  return { valid: true };
}
