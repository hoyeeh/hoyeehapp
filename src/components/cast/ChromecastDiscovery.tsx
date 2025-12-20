import { useState, useEffect } from "react";
import { Tv2, Wifi, RefreshCw, Cast, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGoogleCast } from "@/hooks/useGoogleCast";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ChromecastDiscoveryProps {
  mediaUrl?: string;
  mediaTitle?: string;
  mediaThumbnail?: string;
  onDeviceSelected?: (deviceName: string) => void;
  onCastStart?: () => void;
  onCastEnd?: () => void;
  compact?: boolean;
}

export function ChromecastDiscovery({
  mediaUrl,
  mediaTitle,
  mediaThumbnail,
  onDeviceSelected,
  onCastStart,
  onCastEnd,
  compact = false,
}: ChromecastDiscoveryProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);
  
  const cast = useGoogleCast({
    mediaUrl,
    mediaTitle,
    mediaThumbnail,
  });

  useEffect(() => {
    if (cast.isConnected && onCastStart) {
      onCastStart();
    } else if (!cast.isConnected && onCastEnd) {
      onCastEnd();
    }
  }, [cast.isConnected, onCastStart, onCastEnd]);

  const handleScan = () => {
    setIsScanning(true);
    // The Cast SDK automatically scans for devices
    // We simulate a scan animation for UX
    setTimeout(() => {
      setIsScanning(false);
      if (cast.isAvailable) {
        setShowDeviceList(true);
      } else {
        toast.error("No Chromecast devices found", {
          description: "Make sure your device is on the same WiFi network"
        });
      }
    }, 2000);
  };

  const handleConnect = () => {
    cast.connect();
    setShowDeviceList(false);
    if (cast.deviceName) {
      onDeviceSelected?.(cast.deviceName);
    }
  };

  const handleCastMedia = () => {
    if (mediaUrl) {
      cast.loadMedia(mediaUrl, mediaTitle, mediaThumbnail);
    }
  };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={cast.isConnected ? () => cast.disconnect() : handleConnect}
        disabled={!cast.isAvailable}
        className={cn(
          "gap-2",
          cast.isConnected && "text-primary"
        )}
      >
        <Cast className={cn(
          "h-4 w-4",
          cast.isConnected && "text-primary animate-pulse"
        )} />
        {cast.isConnected ? cast.deviceName : "Cast"}
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chromecast Header */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          cast.isConnected 
            ? "bg-primary/20" 
            : "bg-muted/30"
        )}>
          <Cast className={cn(
            "w-6 h-6",
            cast.isConnected 
              ? "text-primary" 
              : "text-muted-foreground"
          )} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Chromecast</h3>
          <p className="text-sm text-muted-foreground">
            {cast.isConnected 
              ? `Connected to ${cast.deviceName}` 
              : cast.isAvailable 
                ? "Devices available" 
                : "Searching for devices..."}
          </p>
        </div>
        {cast.isAvailable && !cast.isConnected && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleScan}
            disabled={isScanning}
          >
            <RefreshCw className={cn(
              "h-4 w-4",
              isScanning && "animate-spin"
            )} />
          </Button>
        )}
      </div>

      {/* Connection Status */}
      <AnimatePresence mode="wait">
        {cast.isConnected ? (
          <motion.div
            key="connected"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-primary/10 rounded-xl border border-primary/20"
          >
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">Connected to {cast.deviceName}</p>
                <p className="text-xs text-muted-foreground">Ready to cast</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {mediaUrl && (
                <Button 
                  onClick={handleCastMedia}
                  className="flex-1"
                  size="sm"
                >
                  <Tv2 className="w-4 h-4 mr-2" />
                  Cast Now
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => cast.disconnect()}
                size="sm"
              >
                Disconnect
              </Button>
            </div>
          </motion.div>
        ) : isScanning ? (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 bg-muted/20 rounded-xl flex flex-col items-center gap-3"
          >
            <div className="relative">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Wifi className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Scanning for devices...</p>
          </motion.div>
        ) : cast.isAvailable ? (
          <motion.div
            key="available"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Button 
              onClick={handleConnect}
              className="w-full"
              variant="outline"
            >
              <Cast className="w-4 h-4 mr-2" />
              Connect to Chromecast
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="unavailable"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-muted/20 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <Wifi className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-sm">No devices found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Make sure your Chromecast is powered on and connected to the same WiFi network as this device.
                </p>
              </div>
            </div>
            <Button 
              onClick={handleScan}
              variant="ghost"
              size="sm"
              className="w-full mt-3"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Scan Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tips */}
      {!cast.isConnected && (
        <div className="p-3 bg-muted/10 rounded-xl">
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> Chromecast works best when both devices are on the same WiFi network. 
            If you don't see your device, try refreshing or restarting your Chromecast.
          </p>
        </div>
      )}
    </div>
  );
}