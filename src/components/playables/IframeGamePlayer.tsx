import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Gamepad2, Loader2, AlertTriangle, ExternalLink, Maximize2, Shield } from "lucide-react";
import { PlayableGame } from "@/hooks/usePlayableGames";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IframeGamePlayerProps {
  game: PlayableGame;
  onClose: () => void;
  onPlayCountIncrement: () => void;
}

// Domains that support proxying for iframe embedding
const PROXY_SUPPORTED_DOMAINS = [
  "crazygames.com",
  "poki.com",
  "kizi.com",
  "gameflare.com",
  "silvergames.com",
];

function canUseProxy(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return PROXY_SUPPORTED_DOMAINS.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export const IframeGamePlayer = ({ game, onClose, onPlayCountIncrement }: IframeGamePlayerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  // Start with proxy enabled for CrazyGames since they block direct iframe embedding
  const [useProxy, setUseProxy] = useState(() => canUseProxy(game.embed_url));

  // Determine the game URL - use proxy if needed and supported
  const gameUrl = useMemo(() => {
    if (useProxy && canUseProxy(game.embed_url)) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      return `${supabaseUrl}/functions/v1/game-proxy?url=${encodeURIComponent(game.embed_url)}&gameId=${game.id}`;
    }
    return game.embed_url;
  }, [game.embed_url, game.id, useProxy]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    onPlayCountIncrement();
  };

  const handleIframeError = () => {
    setIsLoading(false);
    // If direct embedding failed and proxy is available, try proxy
    if (!useProxy && canUseProxy(game.embed_url)) {
      console.log("Direct embed failed, trying proxy...");
      setIsLoading(true);
      setUseProxy(true);
    } else {
      setHasError(true);
    }
  };

  const handleOpenExternal = () => {
    window.open(game.embed_url, "_blank", "noopener,noreferrer");
  };

  // Enhanced sandbox permissions for better game compatibility
  const sandboxPermissions = [
    "allow-scripts",
    "allow-same-origin",
    "allow-popups",
    "allow-forms",
    "allow-modals",
    "allow-popups-to-escape-sandbox",
    "allow-presentation",
    "allow-orientation-lock",
    "allow-pointer-lock",
  ].join(" ");

  // Feature policy for game features
  const allowPolicy = [
    "accelerometer",
    "autoplay",
    "clipboard-write",
    "encrypted-media",
    "fullscreen",
    "gamepad",
    "gyroscope",
    "picture-in-picture",
    "web-share",
  ].join("; ");

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-background via-background/80 to-transparent p-4">
        <div className="flex items-center gap-3">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{game.title}</h2>
          {game.age_group && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {game.age_group}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {useProxy && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-full">
              <Shield className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-500">Proxied</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenExternal}
            className="rounded-full"
            title="Open in new tab"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-10 w-10 text-primary" />
            </motion.div>
            <p className="text-sm text-muted-foreground">Loading game...</p>
            <p className="text-xs text-muted-foreground/60">This may take a moment</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4 p-6 text-center max-w-md">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">Unable to load game</h3>
            <p className="text-sm text-muted-foreground">
              This game couldn't be loaded in the app. This might be due to the game's 
              security settings or temporary availability issues.
            </p>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={onClose}>
                Go Back
              </Button>
              <Button onClick={handleOpenExternal} className="gap-2">
                Open in Browser
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Iframe with enhanced permissions */}
      <iframe
        key={gameUrl} // Force remount when URL changes
        src={gameUrl}
        className={cn(
          "h-full w-full border-0 pt-16",
          (isLoading || hasError) && "invisible"
        )}
        sandbox={sandboxPermissions}
        allow={allowPolicy}
        allowFullScreen
        loading="eager"
        referrerPolicy="no-referrer-when-downgrade"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title={`Play ${game.title}`}
      />
    </motion.div>
  );
};
