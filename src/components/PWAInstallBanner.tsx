import { X, Download, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { motion, AnimatePresence } from "framer-motion";
import pwaIcon from "@/assets/pwa-icon.png";

export function PWAInstallBanner() {
  const { showBanner, isIOS, canInstall, promptInstall, dismissBanner } = usePWAInstall();

  if (!showBanner) return null;

  const handleInstall = async () => {
    if (canInstall) {
      await promptInstall();
    } else if (isIOS) {
      window.location.href = "/install";
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-20 left-4 right-4 z-[60] md:left-auto md:right-4 md:max-w-sm"
      >
        <div className="relative bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-2xl">
          {/* Close button */}
          <button
            onClick={dismissBanner}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted/50 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex items-start gap-4">
            {/* App Icon */}
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 overflow-hidden">
              <img
                src={pwaIcon}
                alt="Hoyeeh"
                className="w-12 h-12 rounded-lg object-cover"
              />
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <h3 className="font-semibold text-foreground text-base">
                Install Hoyeeh App
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                {isIOS
                  ? "Add to your home screen for the best experience"
                  : "Quick access & offline viewing"}
              </p>
            </div>
          </div>

          {isIOS ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
              <span>Tap</span>
              <Share className="w-4 h-4 text-primary" />
              <span>then</span>
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Plus className="w-3.5 h-3.5" />
                Add to Home Screen
              </span>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              {canInstall ? (
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="flex-1 gap-2"
                >
                  <Download className="w-4 h-4" />
                  Install Now
                </Button>
              ) : (
                <Button
                  onClick={() => window.location.href = "/install"}
                  size="sm"
                  className="flex-1 gap-2"
                >
                  <Download className="w-4 h-4" />
                  How to Install
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={dismissBanner}
              >
                Later
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
