import { motion } from "framer-motion";

const funWords = [
  { text: "Hoyeeh!", color: "from-yellow-400 via-orange-400 to-pink-500", size: "text-4xl md:text-5xl", isMain: true },
  { text: "Fun!", color: "text-pink-400", size: "text-2xl md:text-3xl" },
  { text: "Play!", color: "text-cyan-400", size: "text-2xl md:text-3xl" },
  { text: "Wow!", color: "text-yellow-400", size: "text-3xl md:text-4xl" },
  { text: "Yay!", color: "text-lime-400", size: "text-2xl md:text-3xl" },
  { text: "Magic!", color: "text-purple-400", size: "text-2xl md:text-3xl" },
  { text: "Adventure!", color: "text-orange-400", size: "text-xl md:text-2xl" },
];

const clouds = [
  { size: "w-24 h-12", top: "10%", left: "5%", duration: 15, delay: 0 },
  { size: "w-32 h-16", top: "20%", right: "10%", duration: 20, delay: 2 },
  { size: "w-20 h-10", top: "60%", left: "15%", duration: 18, delay: 5 },
  { size: "w-28 h-14", top: "70%", right: "5%", duration: 22, delay: 8 },
  { size: "w-16 h-8", top: "40%", left: "80%", duration: 16, delay: 3 },
];

const Cloud = ({ size, style, duration, delay }: { size: string; style: React.CSSProperties; duration: number; delay: number }) => (
  <motion.div
    className={`absolute ${size} opacity-60`}
    style={style}
    initial={{ x: -100, opacity: 0 }}
    animate={{ 
      x: [0, 30, 0],
      y: [0, -10, 0],
      opacity: [0.4, 0.7, 0.4]
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  >
    <svg viewBox="0 0 100 50" className="w-full h-full fill-white/80 drop-shadow-lg">
      <ellipse cx="25" cy="35" rx="20" ry="12" />
      <ellipse cx="45" cy="25" rx="25" ry="18" />
      <ellipse cx="70" cy="32" rx="22" ry="14" />
      <ellipse cx="55" cy="38" rx="18" ry="10" />
    </svg>
  </motion.div>
);

const AnimatedWord = ({ 
  text, 
  color, 
  size, 
  index, 
  isMain 
}: { 
  text: string; 
  color: string; 
  size: string; 
  index: number;
  isMain?: boolean;
}) => (
  <motion.div
    className={`font-display font-bold ${size} ${isMain ? `bg-gradient-to-r ${color} bg-clip-text text-transparent drop-shadow-lg` : color}`}
    initial={{ opacity: 0, y: 50, scale: 0.5, rotate: -10 }}
    animate={{ 
      opacity: 1, 
      y: [0, -15, 0],
      scale: [1, 1.1, 1],
      rotate: [-5, 5, -5]
    }}
    transition={{
      opacity: { duration: 0.5, delay: index * 0.15 },
      y: { duration: 2, delay: index * 0.2, repeat: Infinity, ease: "easeInOut" },
      scale: { duration: 2.5, delay: index * 0.3, repeat: Infinity, ease: "easeInOut" },
      rotate: { duration: 3, delay: index * 0.1, repeat: Infinity, ease: "easeInOut" }
    }}
    style={{
      textShadow: isMain 
        ? "0 0 30px rgba(255, 200, 0, 0.5), 0 0 60px rgba(255, 100, 0, 0.3)" 
        : "0 4px 8px rgba(0,0,0,0.2)"
    }}
  >
    {text}
    {isMain && (
      <motion.span
        className="absolute -top-2 -right-2 text-lg"
        animate={{ rotate: [0, 20, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        ✨
      </motion.span>
    )}
  </motion.div>
);

const Sparkle = ({ delay, x, y }: { delay: number; x: string; y: string }) => (
  <motion.div
    className="absolute text-2xl"
    style={{ left: x, top: y }}
    initial={{ opacity: 0, scale: 0 }}
    animate={{ 
      opacity: [0, 1, 0],
      scale: [0.5, 1.2, 0.5],
      rotate: [0, 180, 360]
    }}
    transition={{
      duration: 2,
      delay,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  >
    ⭐
  </motion.div>
);

interface KidsLoadingAnimationProps {
  message?: string;
}

export const KidsLoadingAnimation = ({ message = "Loading..." }: KidsLoadingAnimationProps) => {
  return (
    <div className="relative w-full min-h-[400px] md:min-h-[500px] overflow-hidden rounded-3xl bg-gradient-to-br from-sky-300 via-purple-200 to-pink-200">
      {/* Animated background gradient */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-tr from-yellow-200/50 via-transparent to-cyan-200/50"
        animate={{
          background: [
            "linear-gradient(to top right, rgba(254, 240, 138, 0.5), transparent, rgba(165, 243, 252, 0.5))",
            "linear-gradient(to top right, rgba(254, 205, 211, 0.5), transparent, rgba(187, 247, 208, 0.5))",
            "linear-gradient(to top right, rgba(254, 240, 138, 0.5), transparent, rgba(165, 243, 252, 0.5))"
          ]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating Clouds */}
      {clouds.map((cloud, index) => (
        <Cloud
          key={index}
          size={cloud.size}
          style={{ 
            top: cloud.top, 
            left: cloud.left, 
            right: cloud.right 
          }}
          duration={cloud.duration}
          delay={cloud.delay}
        />
      ))}

      {/* Sparkles */}
      <Sparkle delay={0} x="10%" y="20%" />
      <Sparkle delay={0.5} x="85%" y="15%" />
      <Sparkle delay={1} x="20%" y="70%" />
      <Sparkle delay={1.5} x="75%" y="65%" />
      <Sparkle delay={2} x="50%" y="10%" />
      <Sparkle delay={2.5} x="40%" y="80%" />

      {/* Fun Words Container */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[400px] md:min-h-[500px] gap-4 px-4">
        {/* Main Hoyeeh word at top */}
        <div className="relative">
          <AnimatedWord {...funWords[0]} index={0} />
        </div>

        {/* Other words arranged in rows */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-4">
          {funWords.slice(1, 4).map((word, index) => (
            <AnimatedWord key={word.text} {...word} index={index + 1} />
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {funWords.slice(4).map((word, index) => (
            <AnimatedWord key={word.text} {...word} index={index + 4} />
          ))}
        </div>

        {/* Loading message with bouncing dots */}
        <motion.div
          className="mt-8 flex items-center gap-2 text-lg font-medium text-purple-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <span>{message}</span>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-2 h-2 bg-purple-500 rounded-full"
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.15,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Rainbow arc at bottom */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200%] h-32"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 0.3, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <div className="w-full h-full bg-gradient-to-t from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 rounded-t-full opacity-40 blur-sm" />
      </motion.div>
    </div>
  );
};

export default KidsLoadingAnimation;

