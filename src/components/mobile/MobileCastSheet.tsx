import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Cast, Wifi, Smartphone, Tv, ChevronRight, 
  Loader2, Check, Scan, Link2, Settings, X, QrCode, AlertCircle, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Hooks
import { useCast } from "@/contexts/CastContext";
import { useCastHistory, CastDevice as HistoryDevice } from "@/hooks/useCastHistory";
import { getCastCapabilities } from "@/player/castCapabilities";

// Components
import { CastPairingDialog } from "@/components/cast/CastPairingDialog";
import { DLNASetupGuide } from "@/components/DLNASetupGuide";
import { MobileQRScanner } from "./MobileQRScanner";

interface MobileCastSheetProps {
  open: boolean;
  onClose: () => void;
  videoUrl?: string;
  videoTitle?: string;
  thumbnail?: string;
  currentTime?: number;
  duration?: number;
  onCastStart?: () => void;
}

export function MobileCastSheet({
  open,
  onClose,
  videoUrl = "",
  videoTitle = "",
  thumbnail,
  currentTime = 0,
  duration = 0,
  onCastStart,
}: MobileCastSheetProps) {
  // Device management mode when no video is provided
  const isDeviceManagementMode = !videoUrl;
  const [activeTab, setActiveTab] = useState<"quick" | "dlna" | "history">("quick");
  const [showPairingDialog, setShowPairingDialog] = useState(false);
  const [showDLNASetup, setShowDLNASetup] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Use unified CastContext
  const cast = useCast();
  const castHistory = useCastHistory();

  // Handle Chromecast connection
  const handleChromecast = async () => {
    // Check for platform warning first
    if (cast.chromecast.platformWarning) {
      toast.error(cast.chromecast.platformWarning);
      return;
    }

    if (!cast.chromecast.isAvailable) {
      toast.error("Chromecast not available on this device");
      return;
    }

    try {
      await cast.chromecast.connect();
      if (cast.chromecast.isConnected) {
        castHistory.addDevice({
          id: "chromecast-default",
          name: cast.chromecast.deviceName || "Chromecast",
          type: "chromecast",
        });
        
        // Only load media if we have a video URL
        if (videoUrl) {
          onCastStart?.();
          await cast.chromecast.loadMedia(videoUrl, videoTitle, thumbnail, currentTime);
          toast.success(`Casting to ${cast.chromecast.deviceName}`);
          onClose();
        } else {
          toast.success(`Connected to ${cast.chromecast.deviceName}`);
        }
      }
    } catch (error) {
      console.error("[MobileCastSheet] Chromecast error:", error);
      toast.error("Failed to connect to Chromecast");
    }
  };

  // Handle AirPlay
  const handleAirPlay = () => {
    if (!cast.airPlay.isAvailable) {
      toast.error("AirPlay only works in Safari on Mac or iOS");
      return;
    }
    
    // AirPlay requires a video element to be set up first
    cast.airPlay.showPicker();
  };

  // Handle TV Code pairing
  const handlePairWithCode = async (code: string): Promise<boolean> => {
    try {
      const sessionId = await cast.pairWithCode(code);
      if (sessionId) {
        setShowPairingDialog(false);
        
        // Only load video if we have a URL - use sessionId directly to avoid race condition
        if (videoUrl) {
          onCastStart?.();
          await cast.loadVideo(videoUrl, videoTitle, thumbnail, duration, currentTime, sessionId);
          toast.success(`Connected and casting to TV`);
          onClose();
        } else {
          toast.success(`Connected to TV`);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("[MobileCastSheet] Pairing error:", error);
      toast.error("Failed to pair with TV");
      return false;
    }
  };

  // Handle reconnecting to paired device
  const handleReconnect = async (device: HistoryDevice) => {
    try {
      // Convert HistoryDevice type to CastDevice type for useUniversalCast
      const castDeviceType = device.type === 'airplay' ? 'remote' : device.type;
      const success = await cast.reconnectToDevice({ 
        id: device.id, 
        name: device.customName || device.name,
        type: castDeviceType as 'remote' | 'dlna' | 'chromecast',
      });
      if (success && cast.isConnected) {
        // Only load video if we have a URL
        if (videoUrl) {
          onCastStart?.();
          await cast.loadVideo(videoUrl, videoTitle, thumbnail, duration, currentTime);
          toast.success(`Connected to ${device.name}`);
          onClose();
        } else {
          toast.success(`Connected to ${device.name}`);
        }
      }
    } catch (error) {
      console.error("[MobileCastSheet] Reconnect error:", error);
      toast.error(`Failed to reconnect to ${device.name}`);
    }
  };

  // Handle DLNA device selection
  const handleDLNADevice = async (device: any) => {
    try {
      await cast.dlna.connect(device);
      castHistory.addDevice({
        id: device.id,
        name: device.name,
        type: "dlna",
      });
      
      // Only play media if we have a URL
      if (videoUrl) {
        onCastStart?.();
        await cast.dlna.playMedia(videoUrl, videoTitle, currentTime);
        toast.success(`Casting to ${device.name}`);
        onClose();
      } else {
        toast.success(`Connected to ${device.name}`);
      }
    } catch (error) {
      console.error("[MobileCastSheet] DLNA error:", error);
      toast.error("Failed to connect to Smart TV");
    }
  };

  // Scan for DLNA devices
  const handleDLNAScan = () => {
    cast.dlna.scanForDevices();
  };

  // Recent devices from history
  const recentDevices = castHistory.devices.slice(0, 5);

  // Get current active connection
  const activeConnection = cast.getActiveConnection();

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] bg-black/60"
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
                      disabled={!!cast.chromecast.platformWarning}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl transition-colors",
                        cast.chromecast.platformWarning
                          ? "bg-muted opacity-60"
                          : cast.chromecast.isAvailable
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
                          {cast.chromecast.platformWarning
                            ? "Not available on mobile web"
                            : cast.chromecast.isAvailable
                              ? cast.chromecast.isConnected
                                ? `Connected to ${cast.chromecast.deviceName}`
                                : "Cast to nearby devices"
                              : "Not available"}
                        </p>
                      </div>
                      {cast.chromecast.isConnected ? (
                        <Check className="h-5 w-5 text-primary" />
                      ) : cast.chromecast.platformWarning ? (
                        <Info className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>

                    {/* Platform warning for Chromecast */}
                    {cast.chromecast.platformWarning && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {cast.chromecast.platformWarning}
                        </p>
                      </div>
                    )}

                    {/* AirPlay */}
                    <button
                      onClick={handleAirPlay}
                      disabled={!cast.airPlay.isAvailable}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl transition-colors",
                        cast.airPlay.isAvailable
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
                          {cast.airPlay.isAvailable
                            ? cast.airPlay.isConnected
                              ? `Connected to ${cast.airPlay.deviceName}`
                              : "Cast to Apple TV"
                            : "Only available in Safari"}
                        </p>
                      </div>
                      {cast.airPlay.isConnected && (
                        <Check className="h-5 w-5 text-blue-500" />
                      )}
                    </button>

                    {/* Link with TV Code */}
                    <button
                      onClick={() => setShowPairingDialog(true)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors touch-manipulation"
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

                    {/* Scan QR Code */}
                    <button
                      onClick={() => setShowQRScanner(true)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors touch-manipulation"
                    >
                      <div className="p-3 rounded-full bg-purple-500/10">
                        <QrCode className="h-6 w-6 text-purple-500" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium">Scan QR Code</p>
                        <p className="text-sm text-muted-foreground">
                          Open <span className="font-semibold text-primary">hoyeeh.com/tv</span> on your TV
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>

                    {/* Already connected */}
                    {activeConnection.type && activeConnection.device && (
                      <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/30">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary">
                            <Cast className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Currently casting to</p>
                            <p className="text-primary font-semibold">{activeConnection.device}</p>
                          </div>
                          <button
                            onClick={() => {
                              cast.disconnectAll();
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
                    {/* Platform limitation notice */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        <p className="font-medium mb-1">Web Browser Limitation</p>
                        <p>Automatic device discovery isn't available in browsers. Use "Link with TV Code" for the best experience, or manually add your Smart TV below.</p>
                      </div>
                    </div>

                    {/* Saved/Manual devices */}
                    {cast.dlna.savedDevices.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Saved devices</p>
                        {cast.dlna.savedDevices.map((device) => (
                          <button
                            key={device.id}
                            onClick={() => handleDLNADevice({
                              id: device.id,
                              name: device.name,
                              type: 'dlna' as const,
                              location: `http://${device.ipAddress}:${device.port}`,
                            })}
                            className="w-full flex items-center gap-4 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                          >
                            <div className="p-3 rounded-full bg-primary/10">
                              <Tv className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium">{device.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {device.ipAddress}:{device.port}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Scan button (shows limitations) */}
                    <button
                      onClick={handleDLNAScan}
                      disabled={cast.dlna.isScanning}
                      className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors"
                    >
                      {cast.dlna.isScanning ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Scan className="h-5 w-5" />
                      )}
                      <span className="font-medium">
                        {cast.dlna.isScanning ? "Scanning..." : "Scan for Smart TVs"}
                      </span>
                    </button>

                    {/* Device list from scan */}
                    {cast.dlna.devices.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Found devices</p>
                        {cast.dlna.devices.map((device) => (
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
                            {cast.dlna.connectedDevice?.id === device.id && (
                              <Check className="h-5 w-5 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Empty state */}
                    {cast.dlna.devices.length === 0 && cast.dlna.savedDevices.length === 0 && !cast.dlna.isScanning && (
                      <div className="text-center py-6">
                        <Wifi className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground mb-1">No devices configured</p>
                        <p className="text-sm text-muted-foreground/70 mb-4">
                          Add your Smart TV manually or use TV Code linking
                        </p>
                      </div>
                    )}

                    {/* Setup guide link */}
                    <button
                      onClick={() => setShowDLNASetup(true)}
                      className="w-full flex items-center gap-3 p-3 text-sm text-muted-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Add Smart TV manually</span>
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
                              {device.type === "chromecast" ? (
                                <Cast className="h-6 w-6 text-primary" />
                              ) : device.type === "airplay" ? (
                                <Tv className="h-6 w-6 text-blue-500" />
                              ) : (
                                <Tv className="h-6 w-6 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium">{device.customName || device.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {device.type === "dlna" ? "Smart TV" : device.type}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <Smartphone className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground">No recent devices</p>
                        <p className="text-sm text-muted-foreground/70">
                          Cast to a device to see it here
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogs */}
      <CastPairingDialog
        open={showPairingDialog}
        onOpenChange={setShowPairingDialog}
        onPair={handlePairWithCode}
        isConnecting={cast.isConnecting}
      />

      <DLNASetupGuide
        open={showDLNASetup}
        onOpenChange={setShowDLNASetup}
        onDeviceSelect={(device) => {
          // Add to saved devices using the device info from the guide
          cast.dlna.addManualDevice({
            id: device.id,
            name: device.name,
            ipAddress: device.ipAddress || '192.168.1.1',
            port: device.port || 8080,
          });
          handleDLNADevice({
            id: device.id,
            name: device.name,
            type: 'dlna' as const,
            location: `http://${device.ipAddress || '192.168.1.1'}:${device.port || 8080}`,
          });
        }}
      />

      <MobileQRScanner
        open={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onCodeScanned={async (code) => {
          return await handlePairWithCode(code);
        }}
      />
    </>
  );
}
