import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUniversalCast, CastDevice, PlaybackState, QueueItem } from '@/hooks/useUniversalCast';
import { CastControlBar } from '@/components/cast/CastControlBar';
import { CastMiniPlayer } from '@/components/cast/CastMiniPlayer';

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
  const location = useLocation();
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Show mini player when not on content detail page and casting is active
  useEffect(() => {
    const isOnContentPage = location.pathname.startsWith('/content/');
    const hasActiveMedia = cast.isConnected && cast.playbackState.videoUrl;
    
    if (hasActiveMedia && !isOnContentPage && !isExpanded) {
      setShowMiniPlayer(true);
    } else if (isOnContentPage || isExpanded) {
      setShowMiniPlayer(false);
    }
  }, [location.pathname, cast.isConnected, cast.playbackState.videoUrl, isExpanded]);

  const handleExpand = () => {
    setIsExpanded(true);
    setShowMiniPlayer(false);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  return (
    <CastContext.Provider value={cast}>
      {children}
      
      {/* Mini Player - shows when navigating away from content while casting */}
      {showMiniPlayer && cast.connectedDevice && (
        <CastMiniPlayer
          device={cast.connectedDevice}
          playbackState={cast.playbackState}
          onPlay={cast.play}
          onPause={cast.pause}
          onVolumeChange={cast.setVolume}
          onStop={cast.stop}
          onExpand={handleExpand}
        />
      )}
      
      {/* Full Cast Control Bar - shows when expanded or on content page */}
      {(isExpanded || location.pathname.startsWith('/content/')) && cast.isConnected && cast.connectedDevice && (
        <CastControlBar
          device={cast.connectedDevice}
          playbackState={cast.playbackState}
          onPlay={cast.play}
          onPause={cast.pause}
          onSeek={cast.seek}
          onVolumeChange={cast.setVolume}
          onStop={() => {
            cast.stop();
            handleCollapse();
          }}
          onDisconnect={cast.disconnect}
        />
      )}
    </CastContext.Provider>
  );
}