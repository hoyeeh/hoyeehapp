import { AnimatePresence, motion } from "framer-motion";
import { useMobileVideoPlayer } from "@/contexts/MobileVideoPlayerContext";
import { MobileVideoPlayer } from "./MobileVideoPlayer";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { useKidsTimeLimit } from "@/hooks/useKidsTimeLimit";
import { useCallback } from "react";

export function PersistentMobileVideoPlayer() {
  const { isMobileDevice, isTablet } = useMobileDevice();
  const { playerState, closePlayer, playNextEpisode } = useMobileVideoPlayer();
  const { incrementWatchedTime, logViewingHistory } = useKidsTimeLimit();

  // Handle time updates for kids mode
  const handleTimeUpdate = useCallback((watchedMinutes: number) => {
    if (playerState.isKidsMode && playerState.content) {
      incrementWatchedTime(watchedMinutes);
    }
  }, [playerState.isKidsMode, playerState.content, incrementWatchedTime]);

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

  return (
    <AnimatePresence>
      <motion.div
        key="persistent-mobile-player"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black"
      >
        <MobileVideoPlayer
          content={playerState.content}
          videoUrl={playerState.videoUrl}
          title={playerState.title}
          episodeTitle={playerState.episodeTitle}
          episodeId={playerState.episodeId}
          onClose={handleClose}
          onNextEpisode={playerState.hasNextEpisode ? playNextEpisode : undefined}
          hasNextEpisode={playerState.hasNextEpisode}
          introStartTime={playerState.introStartTime}
          introEndTime={playerState.introEndTime}
          recapStartTime={playerState.recapStartTime}
          recapEndTime={playerState.recapEndTime}
          thumbnail={playerState.thumbnail}
          isKidsMode={playerState.isKidsMode}
          kidsProfileId={playerState.kidsProfileId}
          onTimeUpdate={handleTimeUpdate}
        />
      </motion.div>
    </AnimatePresence>
  );
}
