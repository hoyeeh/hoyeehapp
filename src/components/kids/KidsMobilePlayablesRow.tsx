import { useState } from "react";
import { motion } from "framer-motion";
import { Gamepad2, ChevronRight } from "lucide-react";
import { usePlayableGames, PlayableGame } from "@/hooks/usePlayableGames";
import { PlayableGameCard } from "@/components/playables/PlayableGameCard";
import { PlayableGameModal } from "@/components/playables/PlayableGameModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface KidsMobilePlayablesRowProps {
  className?: string;
}

export const KidsMobilePlayablesRow = ({ className }: KidsMobilePlayablesRowProps) => {
  const navigate = useNavigate();
  const { data: games, isLoading } = usePlayableGames();
  const [selectedGame, setSelectedGame] = useState<PlayableGame | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter for kids-appropriate games (age_group includes kids-friendly options)
  const kidsGames = games?.filter(game => {
    const ageGroup = game.age_group?.toLowerCase() || '';
    return ageGroup.includes('all') || 
           ageGroup.includes('kids') || 
           ageGroup.includes('everyone') ||
           ageGroup.includes('3+') ||
           ageGroup.includes('7+') ||
           !game.age_group; // Include games without age restriction
  });

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
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-30px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-yellow-500/20 rounded-xl mx-3 py-4 border border-amber-500/20 ${className}`}
      >
        <div className="flex items-center justify-between px-5 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              <Gamepad2 className="h-4 w-4 text-white" strokeWidth={2} />
            </div>
            <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">Hoyeeh Playables</h2>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              className="aspect-[3/4] min-w-[110px] rounded-xl flex-shrink-0 bg-white/10"
            />
          ))}
        </div>
      </motion.section>
    );
  }

  if (!kidsGames || kidsGames.length === 0) {
    return null;
  }

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-yellow-500/20 rounded-xl mx-3 py-4 border border-amber-500/20 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
            <Gamepad2 className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">Hoyeeh Playables</h2>
            <p className="text-[11px] text-white/50 font-medium">Play and Learn</p>
          </div>
        </div>
        <button 
          onClick={() => navigate("/kids-games")}
          className="flex items-center gap-1 text-xs text-white/60 active:scale-95 transition-transform"
        >
          <span>See All</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Games row - kids styled */}
      <motion.div
        className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide snap-x snap-mandatory"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {kidsGames.slice(0, 10).map((game, index) => (
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
              className="min-w-[110px] max-w-[130px]"
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
    </motion.section>
  );
};
