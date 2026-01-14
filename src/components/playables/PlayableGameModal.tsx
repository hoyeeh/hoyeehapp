import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Gamepad2, Loader2, AlertTriangle } from "lucide-react";
import { PlayableGame, useIncrementPlayCount } from "@/hooks/usePlayableGames";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PlayableGameModalProps {
  game: PlayableGame | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PlayableGameModal = ({ game, isOpen, onClose }: PlayableGameModalProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const incrementPlayCount = useIncrementPlayCount();

  const handleIframeLoad = () => {
    setIsLoading(false);
    if (game) {
      incrementPlayCount.mutate(game.id);
    }
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleExternalPlay = () => {
    if (game) {
      incrementPlayCount.mutate(game.id);
      window.open(game.embed_url, "_blank", "noopener,noreferrer");
      onClose();
    }
  };

  const handleClose = () => {
    setIsLoading(true);
    setHasError(false);
    onClose();
  };

  if (!game) return null;

  // External game modal
  if (game.embed_type === "external") {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-border">
          <div className="relative">
            {/* Header Image */}
            <div className="h-48 overflow-hidden">
              <img
                src={game.thumbnail_url}
                alt={game.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
            </div>

            {/* Content */}
            <div className="p-6 pt-0 -mt-16 relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Gamepad2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">{game.title}</h2>
              </div>

              {game.description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {game.description}
                </p>
              )}

              <div className="flex items-center gap-2 mb-6">
                {game.age_group && (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                    Ages {game.age_group}
                  </span>
                )}
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {game.source}
                </span>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Opens externally</p>
                    <p className="text-xs text-muted-foreground">
                      This game will open in a new tab on {game.source}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleExternalPlay}
                className="w-full gap-2"
                size="lg"
              >
                <Gamepad2 className="h-5 w-5" />
                Play Now on {game.source}
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Iframe game modal (fullscreen)
  return (
    <AnimatePresence>
      {isOpen && (
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
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading game...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="flex flex-col items-center gap-4 p-6 text-center">
                <AlertTriangle className="h-12 w-12 text-destructive" />
                <h3 className="text-lg font-semibold">Failed to load game</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  This game couldn't be loaded. It may be temporarily unavailable or blocked by your browser.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                  <Button
                    onClick={() => window.open(game.embed_url, "_blank")}
                    className="gap-2"
                  >
                    Open in New Tab
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Iframe */}
          <iframe
            src={game.embed_url}
            className={cn(
              "h-full w-full border-0 pt-16",
              (isLoading || hasError) && "invisible"
            )}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            allowFullScreen
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
