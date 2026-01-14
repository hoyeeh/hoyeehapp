import { useState } from "react";
import { motion } from "framer-motion";
import { Gamepad2, ChevronRight } from "lucide-react";
import { usePlayableGames, PlayableGame } from "@/hooks/usePlayableGames";
import { PlayableGameCard } from "./PlayableGameCard";
import { PlayableGameModal } from "./PlayableGameModal";
import { Skeleton } from "@/components/ui/skeleton";

interface MobilePlayablesRowProps {
  className?: string;
}

export const MobilePlayablesRow = ({ className }: MobilePlayablesRowProps) => {
  const { data: games, isLoading } = usePlayableGames();
  const [selectedGame, setSelectedGame] = useState<PlayableGame | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePlayGame = (game: PlayableGame) => {
    setSelectedGame(game);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedGame(null);
  };

  if (isLoading) {
    return (
      <section className={className}>
        <div className="mb-3 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Hoyeeh Playables</h2>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide">
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="aspect-[3/4] min-w-[120px] rounded-xl flex-shrink-0"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!games || games.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between px-4">
        <div>
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Hoyeeh Playables</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Play and Learn
          </p>
        </div>
        <button className="flex items-center gap-0.5 text-xs text-muted-foreground">
          See All
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Games row - mobile optimized */}
      <motion.div
        className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {games.map((game, index) => (
          <motion.div
            key={game.id}
            className="snap-start flex-shrink-0"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <PlayableGameCard
              game={game}
              onClick={handlePlayGame}
              className="min-w-[120px] max-w-[140px]"
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Game modal */}
      <PlayableGameModal
        game={selectedGame}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </section>
  );
};
