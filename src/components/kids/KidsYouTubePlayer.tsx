import { useState } from "react";
import { X, ArrowLeft, Maximize, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface KidsYouTubePlayerProps {
  videoId: string;
  title: string;
  onClose: () => void;
}

export const KidsYouTubePlayer = ({ videoId, title, onClose }: KidsYouTubePlayerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreen = async () => {
    const iframe = document.querySelector("iframe") as any;
    const doc = document as any;

    if (!iframe) return;

    try {
      const isCurrentlyFullscreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isCurrentlyFullscreen) {
        if (iframe.requestFullscreen) {
          await iframe.requestFullscreen();
        } else if (iframe.webkitRequestFullscreen) {
          await iframe.webkitRequestFullscreen();
        } else if (iframe.mozRequestFullScreen) {
          await iframe.mozRequestFullScreen();
        } else if (iframe.msRequestFullscreen) {
          await iframe.msRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      console.warn('Fullscreen request failed:', error);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#0A0A0F]"
      >
        {/* Header - Responsive */}
        <div className="absolute top-0 left-0 right-0 z-10 p-3 sm:p-4 pt-6 sm:pt-8 bg-gradient-to-b from-black/80 to-transparent safe-area-inset-top">
          <div className="flex items-center justify-between max-w-7xl mx-auto gap-2">
            {/* Back Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 backdrop-blur-md text-white font-medium hover:from-violet-500/40 hover:to-fuchsia-500/40 active:from-violet-500/50 active:to-fuchsia-500/50 transition-all touch-manipulation cursor-pointer border border-white/20"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-sm sm:text-base hidden xs:inline">Back</span>
            </button>

            {/* Title - Hidden on small screens */}
            <h1 className="text-base sm:text-lg font-semibold text-white truncate max-w-[120px] sm:max-w-md mx-2 sm:mx-4 hidden sm:block">
              {title}
            </h1>

            {/* Right side controls */}
            <div className="flex items-center gap-2">
              {/* Fullscreen Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFullscreen();
                }}
                className="flex items-center justify-center p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-cyan-500/30 to-blue-500/30 backdrop-blur-md text-white hover:from-cyan-500/40 hover:to-blue-500/40 active:from-cyan-500/50 active:to-blue-500/50 transition-all touch-manipulation cursor-pointer border border-white/20"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <Maximize className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="flex items-center justify-center p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-rose-500/30 to-pink-500/30 backdrop-blur-md text-white hover:from-rose-500/40 hover:to-pink-500/40 active:from-rose-500/50 active:to-pink-500/50 transition-all touch-manipulation cursor-pointer border border-white/20"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Video Player */}
        <div className="w-full h-full flex items-center justify-center p-4 pt-20">
          <div className="w-full max-w-5xl aspect-video rounded-3xl overflow-hidden shadow-2xl">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&showinfo=0&iv_load_policy=3&cc_load_policy=0&controls=1&endscreen=0`}
              title={title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Decorative elements for kids */}
        <div className="absolute bottom-4 left-4 w-20 h-20 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 blur-xl" />
        <div className="absolute bottom-8 right-8 w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 blur-xl" />
      </motion.div>
    </AnimatePresence>
  );
};
