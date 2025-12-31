import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAUpdates } from '@/hooks/usePWAUpdates';
import { WhatsNewModal } from '@/components/WhatsNewModal';

interface AppUpdateBannerProps {
  autoUpdateDelay?: number; // ms before auto-updating
}

export function AppUpdateBanner({ autoUpdateDelay = 15000 }: AppUpdateBannerProps) {
  const { updateAvailable, updateReady, applyUpdate } = usePWAUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [countdown, setCountdown] = useState(autoUpdateDelay / 1000);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Auto-countdown for update
  useEffect(() => {
    if (!updateReady || dismissed) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          applyUpdate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [updateReady, dismissed, applyUpdate]);

  // Show "What's New" after page reload if version changed
  useEffect(() => {
    const justUpdated = sessionStorage.getItem('hoyeeh-just-updated');
    if (justUpdated) {
      sessionStorage.removeItem('hoyeeh-just-updated');
      setShowWhatsNew(true);
    }
  }, []);

  // Mark that we're updating so we can show changelog after reload
  const handleUpdate = () => {
    sessionStorage.setItem('hoyeeh-just-updated', 'true');
    applyUpdate();
  };

  if (!updateReady || dismissed) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-brand via-brand/90 to-brand p-3 shadow-lg"
        >
          <div className="container mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="text-white">
                <p className="font-semibold text-sm sm:text-base">
                  New update available!
                </p>
                <p className="text-xs sm:text-sm text-white/80">
                  Auto-updating in {countdown}s • 
                  <button 
                    onClick={() => setShowWhatsNew(true)}
                    className="underline ml-1 hover:text-white"
                  >
                    See what's new
                  </button>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleUpdate}
                className="bg-white text-brand hover:bg-white/90 font-semibold"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Update Now
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDismissed(true)}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <WhatsNewModal 
        open={showWhatsNew} 
        onOpenChange={setShowWhatsNew} 
      />
    </>
  );
}
