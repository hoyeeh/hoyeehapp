/**
 * UnifiedCastSheet - Cast options bottom sheet
 * 
 * Provides a unified cast experience across all platforms:
 * - Hoyeeh TV (QR/Code pairing) - Always available
 * - Chromecast - When Cast SDK detects devices
 * - AirPlay - iOS only, instructional UI
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv,
  Cast,
  Airplay,
  X,
  QrCode,
  Smartphone,
  ChevronRight,
  Maximize,
  HelpCircle,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useCast } from "@/contexts/CastContext";

interface UnifiedCastSheetProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoTitle: string;
  videoThumbnail?: string;
  videoDuration?: number;
  onOpenFullscreen?: () => void; // For iOS AirPlay
  isKidsMode?: boolean;
}

interface CastOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  connected?: boolean;
  loading?: boolean;
  action: () => void;
}

export function UnifiedCastSheet({
  isOpen,
  onClose,
  videoUrl,
  videoTitle,
  videoThumbnail,
  videoDuration,
  onOpenFullscreen,
  isKidsMode = false,
}: UnifiedCastSheetProps) {
  const navigate = useNavigate();
  const cast = useCast();
  
  const [showAirPlayHelp, setShowAirPlayHelp] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  
  // Detect iOS for AirPlay
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  // Check Chromecast availability
  const chromecastAvailable = cast.chromecast?.isAvailable || false;
  const chromecastConnected = cast.chromecast?.isConnected || false;

  // Handle Hoyeeh TV pairing
  const handleHoyeehTV = () => {
    onClose();
    navigate('/cast', {
      state: {
        videoUrl,
        title: videoTitle,
        thumbnail: videoThumbnail,
        duration: videoDuration,
      },
    });
  };

  // Handle Chromecast
  const handleChromecast = async () => {
    if (!cast.chromecast) return;
    
    if (chromecastConnected) {
      // Already connected, load video
      setIsConnecting('chromecast');
      try {
        // Use the universal cast loadVideo if available
        await cast.loadVideo?.(videoUrl, videoTitle, videoThumbnail);
        onClose();
      } catch (e) {
        console.error('Chromecast cast error:', e);
      }
      setIsConnecting(null);
    } else {
      // Connect to device
      setIsConnecting('chromecast');
      try {
        await cast.chromecast.connect?.();
      } catch (e) {
        console.error('Chromecast connect error:', e);
      }
      setIsConnecting(null);
    }
  };

  // Handle AirPlay
  const handleAirPlay = () => {
    setShowAirPlayHelp(true);
  };

  const handleOpenFullscreen = () => {
    setShowAirPlayHelp(false);
    onClose();
    onOpenFullscreen?.();
  };

  // Build cast options list
  const castOptions: CastOption[] = [
    {
      id: 'hoyeeh-tv',
      label: 'Cast to Hoyeeh TV',
      description: 'Universal Smart TV receiver with QR/code pairing',
      icon: <Tv className="h-6 w-6" />,
      available: true,
      action: handleHoyeehTV,
    },
  ];

  // Add Chromecast if available
  if (chromecastAvailable) {
    castOptions.push({
      id: 'chromecast',
      label: 'Chromecast',
      description: chromecastConnected 
        ? `Connected to ${cast.chromecast?.deviceName || 'device'}` 
        : 'Cast to nearby Chromecast devices',
      icon: <Cast className="h-6 w-6" />,
      available: true,
      connected: chromecastConnected,
      loading: isConnecting === 'chromecast',
      action: handleChromecast,
    });
  }

  // Add AirPlay on iOS
  if (isIOS || isSafari) {
    castOptions.push({
      id: 'airplay',
      label: 'AirPlay',
      description: 'Stream to Apple TV or AirPlay-compatible devices',
      icon: <Airplay className="h-6 w-6" />,
      available: true,
      action: handleAirPlay,
    });
  }

  // Don't render in kids mode if cast is disabled
  if (isKidsMode) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl overflow-hidden max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Cast to TV</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3 overflow-y-auto">
              {/* Video info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl mb-4">
                {videoThumbnail && (
                  <img 
                    src={videoThumbnail} 
                    alt={videoTitle}
                    className="w-16 h-10 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{videoTitle}</p>
                  <p className="text-sm text-muted-foreground">Ready to cast</p>
                </div>
              </div>

              {/* Cast Options */}
              {castOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={option.action}
                  disabled={!option.available || option.loading}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl transition-colors text-left",
                    option.available 
                      ? "bg-muted/30 hover:bg-muted/50" 
                      : "opacity-50 cursor-not-allowed",
                    option.connected && "ring-2 ring-primary bg-primary/10"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl",
                    option.connected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  )}>
                    {option.loading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : option.connected ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      option.icon
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{option.label}</p>
                    <p className="text-sm text-muted-foreground truncate">{option.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}

              {/* No devices message */}
              {!chromecastAvailable && !isIOS && !isSafari && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Chromecast devices will appear here when detected
                </p>
              )}
            </div>

            {/* Safe area padding */}
            <div className="h-safe-area-inset-bottom" />
          </motion.div>

          {/* AirPlay Help Modal */}
          <AnimatePresence>
            {showAirPlayHelp && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/80 z-[60]"
                  onClick={() => setShowAirPlayHelp(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[90%] max-w-md bg-card rounded-2xl p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Airplay className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      Use AirPlay
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      To use AirPlay, open the video in fullscreen mode, then tap the 
                      <Airplay className="h-4 w-4 inline mx-1" /> 
                      AirPlay icon in the native video controls.
                    </p>

                    <div className="bg-muted/50 rounded-xl p-4 mb-6">
                      <div className="flex items-start gap-3 text-left">
                        <HelpCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-muted-foreground">
                          <p className="font-medium text-foreground mb-1">Tip</p>
                          <p>Make sure your Apple TV or AirPlay device is on the same Wi-Fi network as your {isIOS ? 'iPhone/iPad' : 'Mac'}.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowAirPlayHelp(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 gap-2"
                        onClick={handleOpenFullscreen}
                      >
                        <Maximize className="h-4 w-4" />
                        Open Fullscreen
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
