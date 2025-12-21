import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cast, X, Pause, Play, Volume2, VolumeX, SkipForward, ChevronUp } from "lucide-react";
import { useCast } from "@/contexts/CastContext";
import { cn } from "@/lib/utils";

export function MobileCastStatusIndicator() {
  const cast = useCast();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!cast.isConnected || !cast.connectedDevice) {
    return null;
  }

  const { playbackState } = cast;
  const hasVideo = playbackState.videoUrl && playbackState.videoTitle;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 z-40"
      >
        <motion.div
          layout
          className={cn(
            "bg-primary rounded-2xl shadow-lg overflow-hidden",
            isExpanded ? "pb-4" : ""
          )}
        >
          {/* Collapsed view - tap to expand */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center gap-3 p-3 text-left"
          >
            <div className="p-2 rounded-full bg-white/20">
              <Cast className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/70">Casting to</p>
              <p className="text-sm font-semibold text-white truncate">
                {cast.connectedDevice.name}
              </p>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="p-1"
            >
              <ChevronUp className="h-4 w-4 text-white/70" />
            </motion.div>
          </button>

          {/* Expanded view with controls */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-3"
              >
                {/* Now playing info */}
                {hasVideo && (
                  <div className="flex items-center gap-3 mb-3 p-2 bg-white/10 rounded-xl">
                    {playbackState.videoThumbnail && (
                      <img
                        src={playbackState.videoThumbnail}
                        alt=""
                        className="w-12 h-8 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {playbackState.videoTitle}
                      </p>
                      <p className="text-xs text-white/60">
                        {playbackState.isPlaying ? "Now playing" : "Paused"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Playback controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => cast.setVolume(playbackState.volume === 0 ? 100 : 0)}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all touch-manipulation"
                  >
                    {playbackState.volume === 0 ? (
                      <VolumeX className="h-5 w-5 text-white" />
                    ) : (
                      <Volume2 className="h-5 w-5 text-white" />
                    )}
                  </button>
                  <button
                    onClick={() => playbackState.isPlaying ? cast.pause() : cast.play()}
                    className="p-4 rounded-full bg-white hover:bg-white/90 active:scale-95 transition-all touch-manipulation"
                  >
                    {playbackState.isPlaying ? (
                      <Pause className="h-6 w-6 text-primary" fill="currentColor" />
                    ) : (
                      <Play className="h-6 w-6 text-primary" fill="currentColor" />
                    )}
                  </button>
                  <button
                    onClick={() => cast.seek(playbackState.playbackTime + 30)}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all touch-manipulation"
                  >
                    <SkipForward className="h-5 w-5 text-white" />
                  </button>
                </div>

                {/* Disconnect button */}
                <button
                  onClick={() => cast.disconnect()}
                  className="w-full mt-3 py-2 text-sm text-white/70 hover:text-white flex items-center justify-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Stop Casting
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
