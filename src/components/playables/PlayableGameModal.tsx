import { AnimatePresence } from "framer-motion";
import { PlayableGame, useIncrementPlayCount } from "@/hooks/usePlayableGames";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ExternalGameLauncher } from "./ExternalGameLauncher";
import { IframeGamePlayer } from "./IframeGamePlayer";

interface PlayableGameModalProps {
  game: PlayableGame | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PlayableGameModal = ({ game, isOpen, onClose }: PlayableGameModalProps) => {
  const incrementPlayCount = useIncrementPlayCount();

  const handleExternalLaunch = () => {
    if (game) {
      incrementPlayCount.mutate(game.id);
      window.open(game.embed_url, "_blank", "noopener,noreferrer");
      onClose();
    }
  };

  const handlePlayCountIncrement = () => {
    if (game) {
      incrementPlayCount.mutate(game.id);
    }
  };

  if (!game) return null;

  // External game modal with premium launch experience
  if (game.embed_type === "external") {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-border">
          <ExternalGameLauncher
            game={game}
            onLaunch={handleExternalLaunch}
            onClose={onClose}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Iframe game modal (fullscreen) with enhanced permissions
  return (
    <AnimatePresence>
      {isOpen && (
        <IframeGamePlayer
          game={game}
          onClose={onClose}
          onPlayCountIncrement={handlePlayCountIncrement}
        />
      )}
    </AnimatePresence>
  );
};
