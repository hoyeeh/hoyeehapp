import { AnimatePresence } from "framer-motion";
import { PlayableGame, useIncrementPlayCount } from "@/hooks/usePlayableGames";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ExternalGameLauncher } from "./ExternalGameLauncher";
import { IframeGamePlayer } from "./IframeGamePlayer";
import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

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

// Domains that always open externally (on all devices)
const ALWAYS_EXTERNAL_DOMAINS = [
  "beinternetawesome.withgoogle.com",
  "withgoogle.com",
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

function shouldAlwaysOpenExternal(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ALWAYS_EXTERNAL_DOMAINS.some(domain => 
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
  const navigate = useNavigate();
  const location = useLocation();
  const launchedRef = useRef(false);

  const isMobile = useMemo(() => isMobileDevice(), []);
  
  // Check if this game should open externally
  const shouldOpenExternal = useMemo(() => {
    if (!game) return false;
    // Always open external for certain domains
    if (shouldAlwaysOpenExternal(game.embed_url)) return true;
    // Open external on mobile for mobile-restricted domains
    return isMobile && shouldOpenExternalOnMobile(game.embed_url);
  }, [game, isMobile]);

  // Reset launch ref when game changes
  useEffect(() => {
    launchedRef.current = false;
  }, [game?.id]);

  // Auto-launch external games when modal opens
  useEffect(() => {
    if (isOpen && game && shouldOpenExternal && !launchedRef.current) {
      launchedRef.current = true;
      incrementPlayCount.mutate(game.id);
      
      // Open in new tab
      window.open(game.embed_url, "_blank", "noopener,noreferrer");
      
      // Close modal and ensure user stays on current page
      onClose();
      
      // If somehow navigated away, go back home
      if (location.pathname !== '/' && location.pathname !== '/home') {
        // Small delay to let the modal close first
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
      }
    }
  }, [isOpen, game, shouldOpenExternal, incrementPlayCount, onClose, navigate, location.pathname]);

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

  // If game should open externally, don't render modal (effect handles launch)
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