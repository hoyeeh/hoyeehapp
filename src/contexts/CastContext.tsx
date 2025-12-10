import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useUniversalCast, CastDevice, PlaybackState, QueueItem } from '@/hooks/useUniversalCast';
import { CastControlBar } from '@/components/cast/CastControlBar';

interface CastContextType {
  // State
  isConnecting: boolean;
  isConnected: boolean;
  connectedDevice: CastDevice | null;
  sessionId: string | null;
  playbackState: PlaybackState;
  pairedDevices: CastDevice[];

  // Connection methods
  pairWithCode: (code: string) => Promise<boolean>;
  reconnectToDevice: (device: CastDevice) => Promise<boolean>;
  disconnect: () => void;
  removePairedDevice: (deviceId: string) => void;

  // Playback methods
  loadVideo: (videoUrl: string, title: string, thumbnail?: string, duration?: number, startTime?: number) => Promise<void>;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  stop: () => void;
  updateQueue: (queue: QueueItem[]) => void;
}

const CastContext = createContext<CastContextType | null>(null);

export function useCast() {
  const context = useContext(CastContext);
  if (!context) {
    throw new Error('useCast must be used within a CastProvider');
  }
  return context;
}

interface CastProviderProps {
  children: ReactNode;
}

export function CastProvider({ children }: CastProviderProps) {
  const cast = useUniversalCast();

  return (
    <CastContext.Provider value={cast}>
      {children}
      
      {/* Global Cast Control Bar - shows when connected */}
      {cast.isConnected && cast.connectedDevice && (
        <CastControlBar
          device={cast.connectedDevice}
          playbackState={cast.playbackState}
          onPlay={cast.play}
          onPause={cast.pause}
          onSeek={cast.seek}
          onVolumeChange={cast.setVolume}
          onStop={cast.stop}
          onDisconnect={cast.disconnect}
        />
      )}
    </CastContext.Provider>
  );
}