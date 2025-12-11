import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import hoyeehLogo from "@/assets/hoyeeh-logo-web.png";

interface MobileSplashScreenProps {
  onComplete: () => void;
}

export const MobileSplashScreen = ({ onComplete }: MobileSplashScreenProps) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: fadeOut ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[100] bg-background flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <motion.img
          src={hoyeehLogo}
          alt="Hoyeeh"
          className="w-32 h-32 object-contain"
          animate={{ 
            scale: [1, 1.05, 1],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 100 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="h-1 bg-primary rounded-full"
        />
      </motion.div>
    </motion.div>
  );
};
