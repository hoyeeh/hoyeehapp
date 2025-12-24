import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useKidsSounds } from "@/hooks/useKidsSounds";

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  size: number;
  shape: "circle" | "square" | "star";
}

const colors = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#FFE66D", // Yellow
  "#95E1D3", // Mint
  "#F38181", // Coral
  "#AA96DA", // Purple
  "#FCBAD3", // Pink
  "#A8D8EA", // Sky Blue
];

const shapes = ["circle", "square", "star"] as const;

interface KidsConfettiProps {
  show: boolean;
  duration?: number;
}

export const KidsConfetti = ({ show, duration = 3000 }: KidsConfettiProps) => {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const { playSuccessSound } = useKidsSounds();

  useEffect(() => {
    if (show) {
      // Play success sound
      playSuccessSound();

      // Generate confetti pieces
      const pieces: ConfettiPiece[] = [];
      for (let i = 0; i < 50; i++) {
        pieces.push({
          id: i,
          x: Math.random() * 100,
          color: colors[Math.floor(Math.random() * colors.length)],
          delay: Math.random() * 0.5,
          rotation: Math.random() * 360,
          size: 8 + Math.random() * 12,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
        });
      }
      setConfetti(pieces);

      // Clear confetti after duration
      const timer = setTimeout(() => {
        setConfetti([]);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, playSuccessSound]);

  const renderShape = (piece: ConfettiPiece) => {
    const style = { backgroundColor: piece.color };
    
    switch (piece.shape) {
      case "circle":
        return (
          <div 
            className="rounded-full" 
            style={{ ...style, width: piece.size, height: piece.size }}
          />
        );
      case "square":
        return (
          <div 
            className="rounded-sm" 
            style={{ ...style, width: piece.size, height: piece.size }}
          />
        );
      case "star":
        return (
          <div style={{ fontSize: piece.size, color: piece.color }}>⭐</div>
        );
    }
  };

  return (
    <AnimatePresence>
      {confetti.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {confetti.map((piece) => (
            <motion.div
              key={piece.id}
              className="absolute"
              style={{ left: `${piece.x}%` }}
              initial={{ 
                y: -20, 
                opacity: 1,
                rotate: piece.rotation,
                scale: 0
              }}
              animate={{ 
                y: window.innerHeight + 50,
                opacity: [1, 1, 0],
                rotate: piece.rotation + 720,
                scale: [0, 1, 1, 0.5]
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2.5 + Math.random(),
                delay: piece.delay,
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
            >
              {renderShape(piece)}
            </motion.div>
          ))}
          
          {/* Celebration emojis */}
          {["🎉", "🎊", "⭐", "🌟", "✨"].map((emoji, i) => (
            <motion.div
              key={`emoji-${i}`}
              className="absolute text-4xl"
              style={{ left: `${10 + i * 20}%` }}
              initial={{ y: -50, opacity: 0, scale: 0 }}
              animate={{ 
                y: [0, -100, window.innerHeight / 2],
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0.5],
                rotate: [0, 360]
              }}
              transition={{
                duration: 2,
                delay: 0.1 * i,
                ease: "easeOut"
              }}
            >
              {emoji}
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};

export default KidsConfetti;
