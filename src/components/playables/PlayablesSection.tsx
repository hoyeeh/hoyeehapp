import { useState } from "react";
import { motion } from "framer-motion";
import { Gamepad2, ChevronRight } from "lucide-react";
import { usePlayableGames, PlayableGame } from "@/hooks/usePlayableGames";
import { PlayableGameCard } from "./PlayableGameCard";
import { PlayableGameModal } from "./PlayableGameModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface PlayablesSectionProps {
  className?: string;
}

export const PlayablesSection = ({ className }: PlayablesSectionProps) => {
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
        <div className="mb-4 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Hoyeeh Playables</h2>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto px-4 pb-4 lg:px-8 scrollbar-hide">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton
              key={i}
              className="aspect-[3/4] min-w-[140px] max-w-[180px] rounded-2xl"
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
      <div className="mb-4 flex items-center justify-between px-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Hoyeeh Playables</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Play and Learn — Quick games for all ages
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          See All
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Games row */}
      <div className="relative">
        <motion.div
          className="flex gap-4 overflow-x-auto px-4 pb-4 lg:px-8 scrollbar-hide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {games.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <PlayableGameCard game={game} onClick={handlePlayGame} />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Game modal */}
      <PlayableGameModal
        game={selectedGame}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </section>
  );
};
