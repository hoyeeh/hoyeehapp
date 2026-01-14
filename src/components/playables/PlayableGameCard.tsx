import { motion } from "framer-motion";
import { Gamepad2 } from "lucide-react";
import { PlayableGame } from "@/hooks/usePlayableGames";
import { cn } from "@/lib/utils";

interface PlayableGameCardProps {
  game: PlayableGame;
  onClick: (game: PlayableGame) => void;
  className?: string;
}

export const PlayableGameCard = ({ game, onClick, className }: PlayableGameCardProps) => {
  return (
    <motion.div
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-2xl bg-card",
        "shadow-md hover:shadow-xl transition-shadow duration-300",
        "aspect-[2/3] min-w-[150px] max-w-[200px]",
        className
      )}
      onClick={() => onClick(game)}
      whileHover={{ 
        scale: 1.03,
        rotateY: 2,
        rotateX: -2,
      }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 20 
      }}
    >
      {/* Thumbnail */}
      <div className="relative h-[70%] overflow-hidden">
        <img
          src={game.thumbnail_url}
          alt={game.title}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
        {/* Hover glow effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0"
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
        {/* Play icon overlay */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center opacity-0"
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="rounded-full bg-primary/90 p-3 shadow-lg">
            <Gamepad2 className="h-6 w-6 text-primary-foreground" />
          </div>
        </motion.div>
        {/* External badge */}
        {game.embed_type === "external" && (
          <div className="absolute top-2 right-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
            External
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="flex h-[30%] flex-col justify-center gap-1 p-3">
        <div className="flex items-center gap-1.5">
          <Gamepad2 className="h-3.5 w-3.5 text-primary" />
          <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
            {game.title}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {game.age_group && (
            <span className="rounded bg-muted px-1.5 py-0.5">
              {game.age_group}
            </span>
          )}
          {game.tags?.[0] && (
            <span className="rounded bg-muted px-1.5 py-0.5 capitalize">
              {game.tags[0]}
            </span>
          )}
        </div>
      </div>

      {/* Ripple effect on tap */}
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-primary/50 opacity-0"
        whileTap={{ 
          opacity: [0, 1, 0],
          scale: [1, 1.02, 1],
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
};
