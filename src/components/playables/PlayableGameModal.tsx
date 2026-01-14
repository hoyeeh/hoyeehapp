import { AnimatePresence } from "framer-motion";
import { PlayableGame, useIncrementPlayCount } from "@/hooks/usePlayableGames";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ExternalGameLauncher } from "./ExternalGameLauncher";
import { IframeGamePlayer } from "./IframeGamePlayer";
import { useEffect, useMemo } from "react";

interface PlayableGameModalProps {
  game: PlayableGame | null;
  isOpen: boolean;
  onClose: () => void;
}

// Domains that should always open externally on mobile (don't support mobile iframe)
const MOBILE_EXTERNAL_ONLY_DOMAINS = [
  "crazygames.com",
  "www.crazygames.com",
];

function shouldOpenExternalOnMobile(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return MOBILE_EXTERNAL_ONLY_DOMAINS.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth < 768;
}

export const PlayableGameModal = ({ game, isOpen, onClose }: PlayableGameModalProps) => {
  const incrementPlayCount = useIncrementPlayCount();

  const isMobile = useMemo(() => isMobileDevice(), []);
  
  // Check if this game should open externally on mobile
  const shouldOpenExternal = useMemo(() => {
    if (!game) return false;
    return isMobile && shouldOpenExternalOnMobile(game.embed_url);
  }, [game, isMobile]);

  // Auto-launch external games on mobile when modal opens
  useEffect(() => {
    if (isOpen && game && shouldOpenExternal) {
      incrementPlayCount.mutate(game.id);
      window.open(game.embed_url, "_blank", "noopener,noreferrer");
      onClose();
    }
  }, [isOpen, game, shouldOpenExternal, incrementPlayCount, onClose]);

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

  // If on mobile and game should open externally, don't render anything (effect handles it)
  if (shouldOpenExternal) {
    return null;
  }

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
