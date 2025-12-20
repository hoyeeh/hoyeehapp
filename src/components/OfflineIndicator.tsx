import { useEffect, useState } from "react";
import { WifiOff, Wifi, CloudOff } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const { isOffline, wasOffline } = useOfflineStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  // Show "Back online" message briefly when reconnecting
  useEffect(() => {
    if (!isOffline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  const shouldShow = isOffline || showReconnected;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[100] safe-area-top"
        >
          <div
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium",
              isOffline
                ? "bg-amber-500/95 text-amber-950"
                : "bg-emerald-500/95 text-emerald-950"
            )}
          >
            {isOffline ? (
              <>
                <WifiOff className="w-4 h-4" />
                <span>You're offline — viewing cached content</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                <span>Back online</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Compact version for use in headers/footers
export function OfflineBadge() {
  const { isOffline } = useOfflineStatus();

  if (!isOffline) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/20 text-amber-500 text-xs font-medium"
    >
      <CloudOff className="w-3 h-3" />
      <span>Offline</span>
    </motion.div>
  );
}
