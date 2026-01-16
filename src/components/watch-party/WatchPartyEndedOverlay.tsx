import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface WatchPartyEndedOverlayProps {
  onClose: () => void;
  isKidsMode?: boolean;
}

export const WatchPartyEndedOverlay = ({ onClose, isKidsMode = false }: WatchPartyEndedOverlayProps) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className={`text-center px-8 py-6 rounded-3xl ${
          isKidsMode 
            ? 'bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30' 
            : 'bg-white/10'
        }`}
      >
        <div className="text-5xl mb-4">👋</div>
        <h2 className={`text-2xl font-bold mb-2 ${
          isKidsMode ? 'text-white' : 'text-white'
        }`}>
          Watch Party Ended
        </h2>
        <p className="text-white/70 text-sm mb-4">
          The host has ended this watch party
        </p>
        <div className={`text-lg font-medium ${
          isKidsMode ? 'text-violet-300' : 'text-white/60'
        }`}>
          Closing in {countdown}...
        </div>
      </motion.div>
    </motion.div>
  );
};
