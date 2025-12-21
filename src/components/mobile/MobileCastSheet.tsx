import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Cast, Wifi, Smartphone, Tv, ChevronRight, 
  Loader2, Check, Scan, Link2, Settings, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Hooks
import { useCast } from "@/contexts/CastContext";
import { useGoogleCast } from "@/hooks/useGoogleCast";
import { useDLNA } from "@/hooks/useDLNA";
import { useAirPlay } from "@/hooks/useAirPlay";
import { useCastHistory, CastDevice as HistoryDevice } from "@/hooks/useCastHistory";

// Components
import { CastPairingDialog } from "@/components/cast/CastPairingDialog";
import { DLNASetupGuide } from "@/components/DLNASetupGuide";

interface MobileCastSheetProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  videoTitle: string;
  thumbnail?: string;
  currentTime?: number;
  duration?: number;
  onCastStart?: () => void;
}

export function MobileCastSheet({
  open,
  onClose,
  videoUrl,
  videoTitle,
  thumbnail,
  currentTime = 0,
  duration = 0,
  onCastStart,
}: MobileCastSheetProps) {
  const [activeTab, setActiveTab] = useState<"quick" | "dlna" | "history">("quick");
  const [showPairingDialog, setShowPairingDialog] = useState(false);
  const [showDLNASetup, setShowDLNASetup] = useState(false);

  // Hooks
  const cast = useCast();
  const googleCast = useGoogleCast();
  const dlna = useDLNA();
  const airPlay = useAirPlay();
  const castHistory = useCastHistory();

  // Handle Chromecast connection
  const handleChromecast = async () => {
    if (!googleCast.isAvailable) {
      toast.error("Chromecast not available");
      return;
    }

    try {
      await googleCast.connect();
      if (googleCast.isConnected) {
        onCastStart?.();
        await googleCast.loadMedia(videoUrl, videoTitle, thumbnail, currentTime);
        castHistory.addDevice({
          id: "chromecast-default",
          name: googleCast.deviceName || "Chromecast",
          type: "chromecast",
        });
        toast.success(`Casting to ${googleCast.deviceName}`);
        onClose();
      }
    } catch (error) {
      console.error("[MobileCastSheet] Chromecast error:", error);
      toast.error("Failed to connect to Chromecast");
    }
  };

  // Handle AirPlay
  const handleAirPlay = () => {
    if (!airPlay.isAvailable) {
      toast.error("AirPlay only works in Safari");
      return;
    }
    airPlay.showPicker();
  };

  // Handle TV Code pairing
  const handlePairWithCode = async (code: string) => {
    try {
      await cast.pairWithCode(code);
      onCastStart?.();
      await cast.loadVideo(videoUrl, videoTitle, thumbnail, currentTime, duration);
      setShowPairingDialog(false);
      toast.success(`Connected to TV`);
      onClose();
    } catch (error) {
      console.error("[MobileCastSheet] Pairing error:", error);
      toast.error("Failed to pair with TV");
    }
  };

  // Handle reconnecting to paired device
  const handleReconnect = async (device: HistoryDevice) => {
    try {
      // Convert HistoryDevice type to CastDevice type for useUniversalCast
      const castDeviceType = device.type === 'airplay' ? 'remote' : device.type;
      await cast.reconnectToDevice({ 
        id: device.id, 
        name: device.customName || device.name,
        type: castDeviceType as 'remote' | 'dlna' | 'chromecast',
      });
      if (cast.isConnected) {
        onCastStart?.();
        await cast.loadVideo(videoUrl, videoTitle, thumbnail, currentTime, duration);
        toast.success(`Connected to ${device.name}`);
        onClose();
      }
    } catch (error) {
      console.error("[MobileCastSheet] Reconnect error:", error);
      toast.error(`Failed to reconnect to ${device.name}`);
    }
  };

  // Handle DLNA device selection
  const handleDLNADevice = async (device: any) => {
    try {
      await dlna.connectToDevice(device);
      onCastStart?.();
      await dlna.playMedia(videoUrl, videoTitle, currentTime);
      castHistory.addDevice({
        id: device.id,
        name: device.name,
        type: "dlna",
      });
      toast.success(`Casting to ${device.name}`);
      onClose();
    } catch (error) {
      console.error("[MobileCastSheet] DLNA error:", error);
      toast.error("Failed to connect to Smart TV");
    }
  };

  // Scan for DLNA devices
  const handleDLNAScan = () => {
    dlna.scanForDevices();
  };

  // Recent devices from history
  const recentDevices = castHistory.devices.slice(0, 5);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[210] bg-black/60"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-3 border-b border-border/50">
                <h2 className="text-lg font-bold">Cast to Device</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border/50">
                {[
                  { key: "quick", label: "Quick Cast" },
                  { key: "dlna", label: "Smart TV" },
                  { key: "history", label: "Recent" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={cn(
                      "flex-1 py-3 text-sm font-medium transition-colors relative",
                      activeTab === tab.key
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {tab.label}
                    {activeTab === tab.key && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[50vh] pb-safe">
                {/* Quick Cast Tab */}
                {activeTab === "quick" && (
                  <div className="space-y-3">
                    {/* Chromecast */}
                    <button
                      onClick={handleChromecast}
                      disabled={!googleCast.isAvailable}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl transition-colors",
                        googleCast.isAvailable
                          ? "bg-secondary hover:bg-secondary/80"
                          : "bg-muted opacity-50"
                      )}
                    >
                      <div className="p-3 rounded-full bg-primary/10">
                        <Cast className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium">Chromecast</p>
                        <p className="text-sm text-muted-foreground">
                          {googleCast.isAvailable
                            ? googleCast.isConnected
                              ? `Connected to ${googleCast.deviceName}`
                              : "Cast to nearby devices"
                            : "Not available"}
                        </p>
                      </div>
                      {googleCast.isConnected && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                      {!googleCast.isConnected && googleCast.isAvailable && (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>

                    {/* AirPlay */}
                    <button
                      onClick={handleAirPlay}
                      disabled={!airPlay.isAvailable}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl transition-colors",
                        airPlay.isAvailable
                          ? "bg-secondary hover:bg-secondary/80"
                          : "bg-muted opacity-50"
                      )}
                    >
                      <div className="p-3 rounded-full bg-blue-500/10">
                        <Tv className="h-6 w-6 text-blue-500" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium">AirPlay</p>
                        <p className="text-sm text-muted-foreground">
                          {airPlay.isAvailable
                            ? airPlay.isConnected
                              ? `Connected to ${airPlay.deviceName}`
                              : "Cast to Apple TV"
                            : "Only available in Safari"}
                        </p>
                      </div>
                      {airPlay.isConnected && (
                        <Check className="h-5 w-5 text-blue-500" />
                      )}
                    </button>

                    {/* Link with TV Code */}
                    <button
                      onClick={() => setShowPairingDialog(true)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                    >
                      <div className="p-3 rounded-full bg-green-500/10">
                        <Link2 className="h-6 w-6 text-green-500" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium">Link with TV Code</p>
                        <p className="text-sm text-muted-foreground">
                          Enter the code shown on your TV
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>

                    {/* Already connected */}
                    {cast.isConnected && cast.connectedDevice && (
                      <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/30">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary">
                            <Cast className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Currently casting to</p>
                            <p className="text-primary font-semibold">{cast.connectedDevice.name}</p>
                          </div>
                          <button
                            onClick={async () => {
                              await cast.disconnect();
                              toast.info("Disconnected");
                            }}
                            className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded-lg"
                          >
                            Stop
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* DLNA/Smart TV Tab */}
                {activeTab === "dlna" && (
                  <div className="space-y-3">
                    {/* Scan button */}
                    <button
                      onClick={handleDLNAScan}
                      disabled={dlna.isScanning}
                      className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-primary text-white"
                    >
                      {dlna.isScanning ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Scan className="h-5 w-5" />
                      )}
                      <span className="font-medium">
                        {dlna.isScanning ? "Scanning..." : "Scan for Smart TVs"}
                      </span>
                    </button>

                    {/* Device list */}
                    {dlna.devices.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Available devices</p>
                        {dlna.devices.map((device) => (
                          <button
                            key={device.id}
                            onClick={() => handleDLNADevice(device)}
                            className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                          >
                            <div className="p-3 rounded-full bg-primary/10">
                              <Tv className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium">{device.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {device.manufacturer || "Smart TV"}
                              </p>
                            </div>
                            {dlna.connectedDevice?.id === device.id && (
                              <Check className="h-5 w-5 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : !dlna.isScanning ? (
                      <div className="text-center py-8">
                        <Wifi className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground mb-1">No devices found</p>
                        <p className="text-sm text-muted-foreground/70">
                          Make sure your TV is on the same WiFi network
                        </p>
                      </div>
                    ) : null}

                    {/* Setup guide link */}
                    <button
                      onClick={() => setShowDLNASetup(true)}
                      className="w-full flex items-center gap-3 p-3 text-sm text-muted-foreground"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Need help setting up your Smart TV?</span>
                    </button>
                  </div>
                )}

                {/* Recent Devices Tab */}
                {activeTab === "history" && (
                  <div className="space-y-3">
                    {recentDevices.length > 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground">Recently used devices</p>
                        {recentDevices.map((device: HistoryDevice) => (
                          <button
                            key={device.id}
                            onClick={() => handleReconnect(device)}
                            className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                          >
                            <div className="p-3 rounded-full bg-primary/10">
                              {device.type === "chromecast" && <Cast className="h-6 w-6 text-primary" />}
                              {device.type === "dlna" && <Tv className="h-6 w-6 text-primary" />}
                              {device.type === "airplay" && <Tv className="h-6 w-6 text-blue-500" />}
                              {!["chromecast", "dlna", "airplay"].includes(device.type) && (
                                <Smartphone className="h-6 w-6 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium">{device.customName || device.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {device.type} • Last used {new Date(device.lastUsed).toLocaleDateString()}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <Cast className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground">No recent devices</p>
                        <p className="text-sm text-muted-foreground/70">
                          Cast to a device to see it here
                        </p>
                      </div>
                    )}

                    {/* Clear history */}
                    {recentDevices.length > 0 && (
                      <button
                        onClick={() => {
                          castHistory.clearHistory();
                          toast.success("Device history cleared");
                        }}
                        className="w-full text-center text-sm text-destructive p-3"
                      >
                        Clear device history
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pairing Dialog */}
      <CastPairingDialog
        open={showPairingDialog}
        onOpenChange={setShowPairingDialog}
        onPair={async (code: string) => {
          await handlePairWithCode(code);
          return true;
        }}
        isConnecting={cast.isConnecting}
      />

      {/* DLNA Setup Guide */}
      <DLNASetupGuide
        open={showDLNASetup}
        onOpenChange={setShowDLNASetup}
      />
    </>
  );
}
