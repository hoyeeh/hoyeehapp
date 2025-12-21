import { AnimatePresence, motion } from "framer-motion";
import { useMobileVideoPlayer } from "@/contexts/MobileVideoPlayerContext";
import { MobileVideoPlayer } from "./MobileVideoPlayer";
import { useMobileDevice } from "@/hooks/useMobileDevice";

export function PersistentMobileVideoPlayer() {
  const { isMobileDevice, isTablet } = useMobileDevice();
  const { playerState, closePlayer, playNextEpisode } = useMobileVideoPlayer();

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
          onClose={closePlayer}
          onNextEpisode={playerState.hasNextEpisode ? playNextEpisode : undefined}
          hasNextEpisode={playerState.hasNextEpisode}
          introStartTime={playerState.introStartTime}
          introEndTime={playerState.introEndTime}
          recapStartTime={playerState.recapStartTime}
          recapEndTime={playerState.recapEndTime}
          thumbnail={playerState.thumbnail}
        />
      </motion.div>
    </AnimatePresence>
  );
}
