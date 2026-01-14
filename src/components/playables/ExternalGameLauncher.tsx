import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Gamepad2, Shield, Clock, Sparkles } from "lucide-react";
import { PlayableGame } from "@/hooks/usePlayableGames";
import { Button } from "@/components/ui/button";

interface ExternalGameLauncherProps {
  game: PlayableGame;
  onLaunch: () => void;
  onClose: () => void;
}

export const ExternalGameLauncher = ({ game, onLaunch, onClose }: ExternalGameLauncherProps) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown === 0) {
      onLaunch();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onLaunch]);

  const handleLaunchClick = () => {
    setIsLaunching(true);
    setCountdown(3);
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* Hero Image with Overlay */}
      <div className="relative h-56 overflow-hidden">
        <motion.img
          src={game.thumbnail_url}
          alt={game.title}
          className="h-full w-full object-cover"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5 }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-transparent" />
        
        {/* Floating particles animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary/30"
              initial={{ 
                x: Math.random() * 100 + "%", 
                y: "100%",
                opacity: 0 
              }}
              animate={{ 
                y: "-20%",
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 3,
                delay: i * 0.5,
                repeat: Infinity,
                ease: "easeOut"
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 pt-0 -mt-12 relative z-10 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Gamepad2 className="h-6 w-6 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground">{game.title}</h2>
        </div>

        {game.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {game.description}
          </p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {game.age_group && (
            <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
              Ages {game.age_group}
            </span>
          )}
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {game.source}
          </span>
          {game.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>

        {/* Safety Tips Card */}
        <motion.div 
          className="bg-muted/50 rounded-xl p-4 mb-5 border border-border/50"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Safe Gaming Tips</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Take breaks every 20 minutes
                </li>
                <li className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Have fun and learn something new!
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* External Notice */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-5">
          <div className="flex items-start gap-2">
            <ExternalLink className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This game will open in a new tab on <strong>{game.source}</strong>. 
              You can close that tab to return here anytime.
            </p>
          </div>
        </div>

        {/* Launch Section */}
        <div className="mt-auto">
          <AnimatePresence mode="wait">
            {isLaunching && countdown !== null ? (
              <motion.div
                key="countdown"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center py-4"
              >
                <motion.div
                  key={countdown}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="text-5xl font-bold text-primary mb-2"
                >
                  {countdown === 0 ? "🚀" : countdown}
                </motion.div>
                <p className="text-sm text-muted-foreground">
                  {countdown === 0 ? "Launching..." : "Get ready to play!"}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="buttons"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Maybe Later
                </Button>
                <Button
                  onClick={handleLaunchClick}
                  className="flex-1 gap-2 bg-gradient-to-r from-primary to-primary/80"
                  size="lg"
                >
                  <Gamepad2 className="h-5 w-5" />
                  Play Now
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
