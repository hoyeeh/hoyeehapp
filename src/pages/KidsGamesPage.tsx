import { useState } from "react";
import { motion } from "framer-motion";
import { Gamepad2, ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlayableGames, PlayableGame } from "@/hooks/usePlayableGames";
import { PlayableGameCard } from "@/components/playables/PlayableGameCard";
import { PlayableGameModal } from "@/components/playables/PlayableGameModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function KidsGamesPage() {
  const navigate = useNavigate();
  const { data: games, isLoading } = usePlayableGames();
  const [selectedGame, setSelectedGame] = useState<PlayableGame | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter for kids-appropriate games
  const kidsGames = games?.filter(game => {
    const ageGroup = game.age_group?.toLowerCase() || '';
    return ageGroup.includes('all') || 
           ageGroup.includes('kids') || 
           ageGroup.includes('everyone') ||
           ageGroup.includes('3+') ||
           ageGroup.includes('7+') ||
           !game.age_group;
  });

  const handlePlayGame = (game: PlayableGame) => {
    setSelectedGame(game);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedGame(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A0A0F] via-[#12121A] to-[#0A0A0F] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              <Gamepad2 className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Hoyeeh Playables</h1>
              <p className="text-xs text-white/50">Play and Learn</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-6">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : kidsGames && kidsGames.length > 0 ? (
          <>
            {/* Featured banner */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20 border border-amber-500/20 p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">Fun Games</span>
              </div>
              <p className="text-white/70 text-sm">
                Educational and entertaining games for kids of all ages!
              </p>
            </motion.div>

            {/* Games grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {kidsGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <PlayableGameCard
                    game={game}
                    onClick={handlePlayGame}
                    className="w-full"
                  />
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center mb-6">
              <Gamepad2 className="h-10 w-10 text-white" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No Games Yet</h2>
            <p className="text-sm text-white/50">
              Check back soon for fun games!
            </p>
          </div>
        )}
      </div>

      {/* Game modal */}
      <PlayableGameModal
        game={selectedGame}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
