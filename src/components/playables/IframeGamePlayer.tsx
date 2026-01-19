import { useEffect, useMemo, useState } from "react";
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
  // Popular game portals
  "crazygames.com",
  "poki.com",
  "kizi.com",
  "gameflare.com",
  "silvergames.com",
  // itch.io - indie games
  "itch.io",
  "html-classic.itch.zone",
  "html.itch.zone",
  // Educational portals
  "pbskids.org",
  "education.com",
  "abcya.com",
  "coolmathgames.com",
  "funbrain.com",
  "brainpop.com",
  "starfall.com",
  "typingclub.com",
  "typing.com",
  "kids.nationalgeographic.com",
  "scratch.mit.edu",
  "studio.code.org",
  "mathplayground.com",
  "sheppardsoftware.com",
  "arcademics.com",
  // More portals
  "armorgames.com",
  "kongregate.com",
  "newgrounds.com",
  "gamesgames.com",
  "miniclip.com",
  "beinternetawesome.withgoogle.com",
];

function canUseProxy(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return PROXY_SUPPORTED_DOMAINS.some((domain) =>
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export const IframeGamePlayer = ({ game, onClose, onPlayCountIncrement }: IframeGamePlayerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorType, setErrorType] = useState<'general' | 'auth' | 'blocked'>('general');

  // IMPORTANT: start with direct embedding; proxying can introduce strict CSPs depending on the platform.
  const [useProxy, setUseProxy] = useState(false);
  const [showSlowLoadHelp, setShowSlowLoadHelp] = useState(false);
  const [proxyAttempted, setProxyAttempted] = useState(false);

  const canProxyThisGame = useMemo(() => canUseProxy(game.embed_url), [game.embed_url]);

  // Determine the game URL - use proxy if toggled and supported
  const gameUrl = useMemo(() => {
    if (useProxy && canProxyThisGame) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      return `${supabaseUrl}/functions/v1/game-proxy?url=${encodeURIComponent(game.embed_url)}&gameId=${game.id}`;
    }
    return game.embed_url;
  }, [canProxyThisGame, game.embed_url, game.id, useProxy]);

  // Reset UI state when the iframe URL changes (game change, proxy toggle)
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setShowSlowLoadHelp(false);
  }, [gameUrl]);

  // If loading takes too long, surface troubleshooting actions
  useEffect(() => {
    if (!isLoading) return;
    const t = window.setTimeout(() => setShowSlowLoadHelp(true), 8000);
    return () => window.clearTimeout(t);
  }, [isLoading, gameUrl]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
    setShowSlowLoadHelp(false);
    onPlayCountIncrement();
  };

  const handleIframeError = () => {
    setIsLoading(false);

    // If direct embedding failed and proxy is available, try proxy once
    if (!useProxy && canProxyThisGame && !proxyAttempted) {
      console.log("Direct embed failed, trying proxy...");
      setUseProxy(true);
      setProxyAttempted(true);
      return;
    }

    // Detect auth-related errors (401/403) - show specific messaging
    setErrorType('blocked');
    setHasError(true);
  };

  const handleOpenExternal = () => {
    window.open(game.embed_url, "_blank", "noopener,noreferrer");
  };

  const handleToggleProxy = () => {
    if (!canProxyThisGame) return;
    setUseProxy((prev) => !prev);
  };

  // Enhanced sandbox permissions for better game compatibility
  // SECURITY NOTE: when proxied, avoid allow-same-origin to prevent the proxied page from becoming same-origin with our app.
  const sandboxPermissions = [
    "allow-scripts",
    ...(useProxy ? [] : ["allow-same-origin"]),
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

            {showSlowLoadHelp && (
              <div className="mt-2 flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground/70">
                  Still stuck? Try an alternative launch.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {canProxyThisGame && (
                    <Button size="sm" variant="outline" onClick={handleToggleProxy}>
                      {useProxy ? "Try Direct" : "Try Proxied"}
                    </Button>
                  )}
                  <Button size="sm" onClick={handleOpenExternal} className="gap-2">
                    Open in Browser
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
            <h3 className="text-lg font-semibold">
              {errorType === 'blocked' ? "Game Blocked Embedding" : "Unable to load game"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {errorType === 'blocked' 
                ? "This game provider doesn't allow in-app embedding. Open it in your browser for the best experience!"
                : "This game couldn't be loaded in the app. This might be due to the game's security settings or temporary availability issues."
              }
            </p>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={onClose}>
                Go Back
              </Button>
              <Button onClick={handleOpenExternal} className="gap-2 bg-primary hover:bg-primary/90">
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
