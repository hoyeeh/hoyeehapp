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
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent safe-area-inset-top">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm text-white font-medium hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation cursor-pointer"
              style={{ minHeight: 48 }}
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <h1 className="text-lg font-semibold text-white truncate max-w-md mx-4">
              {title}
            </h1>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFullscreen();
                }}
                className="p-3 rounded-xl bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation cursor-pointer"
                style={{ minWidth: 48, minHeight: 48 }}
              >
                <Maximize className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-3 rounded-xl bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation cursor-pointer"
                style={{ minWidth: 48, minHeight: 48 }}
              >
                <X className="h-5 w-5" />
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
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&showinfo=0&iv_load_policy=3&cc_load_policy=0&controls=1`}
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
