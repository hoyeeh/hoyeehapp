import { AnimatePresence, motion } from "framer-motion";
import { useMobileVideoPlayer } from "@/contexts/MobileVideoPlayerContext";
import { MobileVideoPlayer } from "./MobileVideoPlayer";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { useKidsTimeLimit } from "@/hooks/useKidsTimeLimit";
import { useBedtimeMode } from "@/hooks/useBedtimeMode";
import { useResolvedVideoSrc } from "@/hooks/useResolvedVideoSrc";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";


export function PersistentMobileVideoPlayer() {
  const { isMobileDevice, isTablet } = useMobileDevice();
  const { playerState, closePlayer, playNextEpisode } = useMobileVideoPlayer();
  const { incrementWatchedTime, logViewingHistory, timeRemaining, isTimeLimitReached, checkAndResetDailyTime } = useKidsTimeLimit();
  const { isBedtime } = useBedtimeMode();
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number | null>(null);
  const [localTimeLimitReached, setLocalTimeLimitReached] = useState(false);
  const [localBedtimeReached, setLocalBedtimeReached] = useState(false);

  // Sync time limit and bedtime state when player opens in kids mode
  useEffect(() => {
    if (playerState.isOpen && playerState.isKidsMode) {
      checkAndResetDailyTime();
      setLocalTimeRemaining(timeRemaining);
      setLocalTimeLimitReached(isTimeLimitReached);
      setLocalBedtimeReached(isBedtime);
    }
  }, [playerState.isOpen, playerState.isKidsMode, timeRemaining, isTimeLimitReached, isBedtime, checkAndResetDailyTime]);

  // Continuously check bedtime status while playing
  useEffect(() => {
    if (playerState.isOpen && playerState.isKidsMode) {
      const interval = setInterval(() => {
        setLocalBedtimeReached(isBedtime);
      }, 30000); // Check every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [playerState.isOpen, playerState.isKidsMode, isBedtime]);

  // Handle time updates for kids mode
  const handleTimeUpdate = useCallback((watchedMinutes: number) => {
    if (playerState.isKidsMode && playerState.content) {
      incrementWatchedTime(watchedMinutes);
      
      // Update local time remaining
      if (localTimeRemaining !== null) {
        const newRemaining = Math.max(0, localTimeRemaining - watchedMinutes);
        setLocalTimeRemaining(newRemaining);
        if (newRemaining <= 0) {
          setLocalTimeLimitReached(true);
        }
      }
    }
  }, [playerState.isKidsMode, playerState.content, incrementWatchedTime, localTimeRemaining]);

  // Handle close with viewing history logging for kids
  const handleClose = useCallback(() => {
    if (playerState.isKidsMode && playerState.content) {
      // Log the viewing session
      logViewingHistory(playerState.content.id, 1, false);
    }
    closePlayer();
  }, [playerState.isKidsMode, playerState.content, logViewingHistory, closePlayer]);

  // Only render on mobile/tablet devices
  if (!isMobileDevice && !isTablet) {
    return null;
  }

  if (!playerState.isOpen || !playerState.content) {
    return null;
  }

  // Transparently resolve offline blob URLs (legacy DRM-store wins, then
  // the lightweight new store). Falls back to the network URL when nothing
  // is downloaded. Lifecycle of the blob URL is managed by the hook.
  const { src: resolvedVideoUrl, isResolving, isOffline } = useResolvedVideoSrc(
    playerState.content?.id,
    playerState.episodeId,
    playerState.videoUrl,
  );

  return (
    <AnimatePresence>
      <motion.div
        key="persistent-mobile-player"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black"
      >
        {isResolving ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </div>
        ) : (
          <MobileVideoPlayer
            key={`${playerState.content.id}-${playerState.episodeId || 'movie'}-${isOffline ? 'offline' : 'online'}`}
            content={playerState.content}
            videoUrl={resolvedVideoUrl}
            title={playerState.title}

          episodeTitle={playerState.episodeTitle}
          episodeId={playerState.episodeId}
          onClose={handleClose}
          onNextEpisode={playerState.hasNextEpisode ? playNextEpisode : undefined}
          hasNextEpisode={playerState.hasNextEpisode}
          nextEpisodeInfo={playerState.nextEpisode ? {
            id: playerState.nextEpisode.id,
            title: playerState.nextEpisode.title,
            episodeNumber: playerState.nextEpisode.episode_number,
            thumbnail: playerState.nextEpisode.thumbnail_url,
          } : undefined}
          introStartTime={playerState.introStartTime}
          introEndTime={playerState.introEndTime}
          recapStartTime={playerState.recapStartTime}
          recapEndTime={playerState.recapEndTime}
          thumbnail={playerState.thumbnail}
          isKidsMode={playerState.isKidsMode}
          kidsProfileId={playerState.kidsProfileId}
          onTimeUpdate={handleTimeUpdate}
          kidsTimeRemaining={localTimeRemaining}
          kidsTimeLimitReached={localTimeLimitReached}
          kidsBedtimeReached={localBedtimeReached}
        />
        )}
      </motion.div>

    </AnimatePresence>
  );
}
