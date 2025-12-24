import { motion } from "framer-motion";
import { useEffect } from "react";
import { useKidsSounds } from "@/hooks/useKidsSounds";

const encouragingMessages = [
  { text: "Oopsie!", emoji: "🙈" },
  { text: "Try Again!", emoji: "💪" },
  { text: "No Worries!", emoji: "🌈" },
  { text: "It's Okay!", emoji: "🤗" },
  { text: "You Got This!", emoji: "⭐" },
];

const friendlyTips = [
  "Let's give it another go!",
  "Sometimes things need a second try!",
  "Every superhero faces challenges!",
  "Shake it off and try again!",
  "The best adventures have bumps!",
];

const Cloud = ({ size, style, duration, delay }: { size: string; style: React.CSSProperties; duration: number; delay: number }) => (
  <motion.div
    className={`absolute ${size} opacity-40`}
    style={style}
    initial={{ opacity: 0 }}
    animate={{ 
      opacity: [0.3, 0.5, 0.3],
      y: [0, -5, 0],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  >
    <svg viewBox="0 0 100 50" className="w-full h-full fill-white/60 drop-shadow-lg">
      <ellipse cx="25" cy="35" rx="20" ry="12" />
      <ellipse cx="45" cy="25" rx="25" ry="18" />
      <ellipse cx="70" cy="32" rx="22" ry="14" />
      <ellipse cx="55" cy="38" rx="18" ry="10" />
    </svg>
  </motion.div>
);

interface KidsErrorAnimationProps {
  message?: string;
  onRetry?: () => void;
}

export const KidsErrorAnimation = ({ message, onRetry }: KidsErrorAnimationProps) => {
  const { playEncouragingSound } = useKidsSounds();
  
  // Pick random encouraging content
  const randomMessage = encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];
  const randomTip = friendlyTips[Math.floor(Math.random() * friendlyTips.length)];

  useEffect(() => {
    // Play encouraging sound on mount
    const timer = setTimeout(() => {
      playEncouragingSound();
    }, 500);
    return () => clearTimeout(timer);
  }, [playEncouragingSound]);

  return (
    <div className="relative w-full min-h-[400px] md:min-h-[500px] overflow-hidden rounded-3xl bg-gradient-to-br from-amber-200 via-orange-100 to-pink-200">
      {/* Soft animated background */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            "linear-gradient(135deg, rgba(254, 243, 199, 0.8), rgba(254, 215, 170, 0.5), rgba(252, 231, 243, 0.8))",
            "linear-gradient(135deg, rgba(252, 231, 243, 0.8), rgba(254, 243, 199, 0.5), rgba(254, 215, 170, 0.8))",
            "linear-gradient(135deg, rgba(254, 243, 199, 0.8), rgba(254, 215, 170, 0.5), rgba(252, 231, 243, 0.8))"
          ]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Clouds */}
      <Cloud size="w-20 h-10" style={{ top: "15%", left: "10%" }} duration={12} delay={0} />
      <Cloud size="w-28 h-14" style={{ top: "25%", right: "15%" }} duration={15} delay={2} />
      <Cloud size="w-16 h-8" style={{ top: "60%", left: "5%" }} duration={10} delay={4} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[400px] md:min-h-[500px] gap-6 px-6 text-center">
        {/* Animated sad-but-hopeful character */}
        <motion.div
          className="text-8xl"
          initial={{ scale: 0, rotate: -10 }}
          animate={{ 
            scale: 1, 
            rotate: [0, -5, 5, 0],
          }}
          transition={{
            scale: { duration: 0.5, type: "spring" },
            rotate: { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          {randomMessage.emoji}
        </motion.div>

        {/* Main message */}
        <motion.h2
          className="text-4xl md:text-5xl font-display font-bold text-orange-600 drop-shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {randomMessage.text}
        </motion.h2>

        {/* Encouraging tip */}
        <motion.p
          className="text-lg md:text-xl text-orange-500/80 font-medium max-w-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {message || randomTip}
        </motion.p>

        {/* Floating stars */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl"
            style={{ 
              left: `${15 + i * 18}%`, 
              top: `${20 + (i % 3) * 20}%` 
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0.4, 0.8, 0.4],
              scale: [0.8, 1.2, 0.8],
              rotate: [0, 180, 360]
            }}
            transition={{
              duration: 3,
              delay: i * 0.3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            ✨
          </motion.div>
        ))}

        {/* Retry button */}
        {onRetry && (
          <motion.button
            onClick={onRetry}
            className="mt-4 px-8 py-4 bg-gradient-to-r from-orange-400 to-pink-400 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, type: "spring" }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🔄 Try Again!
          </motion.button>
        )}

        {/* Hearts floating up */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={`heart-${i}`}
            className="absolute bottom-10 text-3xl"
            style={{ left: `${30 + i * 20}%` }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ 
              y: -150,
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 3,
              delay: i * 1.5,
              repeat: Infinity,
              ease: "easeOut"
            }}
          >
            💖
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default KidsErrorAnimation;
