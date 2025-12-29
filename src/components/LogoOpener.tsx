import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LogoOpenerProps {
  onComplete: () => void;
  skipAfterSeconds?: number;
}

export function LogoOpener({ onComplete, skipAfterSeconds = 1.5 }: LogoOpenerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [canSkip, setCanSkip] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      onComplete();
    };

    const handleError = () => {
      console.error("[LogoOpener] Failed to load opener video");
      setHasError(true);
      // Skip to main content on error
      onComplete();
    };

    const handleLoadedData = () => {
      // Video data is loaded, now it's safe to display
      setIsVideoReady(true);
    };

    const handleCanPlay = () => {
      setIsVideoReady(true);
      // Try to play with sound first
      video.muted = false;
      video.play().catch(() => {
        // If autoplay with sound fails, try muted
        console.log("[LogoOpener] Autoplay with sound blocked, trying muted");
        video.muted = true;
        video.play().catch(() => {
          // If even muted fails, skip to content
          console.log("[LogoOpener] Autoplay completely blocked, skipping");
          onComplete();
        });
      });
    };

    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("loadeddata", handleLoadedData);

    // Enable skip after delay
    const skipTimer = setTimeout(() => {
      setCanSkip(true);
    }, skipAfterSeconds * 1000);

    // Fallback timeout - if video doesn't load within 5 seconds, skip
    const fallbackTimer = setTimeout(() => {
      if (!isVideoReady) {
        console.log("[LogoOpener] Video load timeout, skipping");
        onComplete();
      }
    }, 5000);

    return () => {
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("loadeddata", handleLoadedData);
      clearTimeout(skipTimer);
      clearTimeout(fallbackTimer);
    };
  }, [onComplete, skipAfterSeconds, isVideoReady]);

  if (hasError) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
    >
      <video
        ref={videoRef}
        src="/branding/Logo_Opener_Light.mp4"
        className="w-full h-full object-contain opacity-100"
        style={{ visibility: 'visible', display: 'block' }}
        playsInline
        autoPlay
        preload="auto"
      />
      
      <AnimatePresence>
        {canSkip && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={onComplete}
            className="absolute bottom-8 right-8 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-white text-sm font-medium transition-colors"
          >
            Skip
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
