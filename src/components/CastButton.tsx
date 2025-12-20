import { useState, useEffect, useRef } from 'react';
import { Cast, Tv, Settings, AlertCircle, RefreshCw, Wifi, Airplay } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGoogleCast } from '@/hooks/useGoogleCast';
import { useDLNA } from '@/hooks/useDLNA';
import { useAirPlay } from '@/hooks/useAirPlay';
import { DLNASetupGuide } from '@/components/DLNASetupGuide';
import { toast } from 'sonner';

interface CastButtonProps {
  mediaUrl?: string;
  mediaTitle?: string;
  mediaThumbnail?: string;
  currentTime?: number;
  className?: string;
  onCastStart?: () => void;
  onCastEnd?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

interface SavedDLNADevice {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
}

export function CastButton({
  mediaUrl,
  mediaTitle,
  mediaThumbnail,
  currentTime = 0,
  className,
  onCastStart,
  onCastEnd,
  videoRef,
}: CastButtonProps) {
  const [showDLNASetup, setShowDLNASetup] = useState(false);
  const [savedDLNADevices, setSavedDLNADevices] = useState<SavedDLNADevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  
  const cast = useGoogleCast({
    mediaUrl,
    mediaTitle,
    mediaThumbnail,
  });
  
  const dlna = useDLNA();
  
  const airplay = useAirPlay({
    onConnect: onCastStart,
    onDisconnect: onCastEnd,
  });

  // Setup AirPlay with video ref
  useEffect(() => {
    if (videoRef?.current) {
      airplay.setupVideo(videoRef.current);
    }
  }, [videoRef?.current, airplay.setupVideo]);

  // Load saved DLNA devices
  useEffect(() => {
    const saved = localStorage.getItem('dlna_saved_devices');
    if (saved) {
      setSavedDLNADevices(JSON.parse(saved));
    }
  }, [showDLNASetup]);

  useEffect(() => {
    if (cast.isConnected || dlna.connectedDevice) {
      onCastStart?.();
    } else {
      onCastEnd?.();
    }
  }, [cast.isConnected, dlna.connectedDevice, onCastStart, onCastEnd]);

  const handleScanForDevices = () => {
    setIsScanning(true);
    toast.info("Scanning for cast devices...", {
      description: "Make sure your devices are on the same WiFi network"
    });
    
    // Simulate scanning - in reality the Cast SDK auto-discovers
    setTimeout(() => {
      setIsScanning(false);
      if (cast.isAvailable) {
        toast.success("Chromecast devices found!");
      } else {
        toast.info("No new devices found", {
          description: "Try refreshing or check your network connection"
        });
      }
    }, 2000);
  };

  const handleCastClick = () => {
    if (cast.isConnected) {
      // Already connected - show options
    } else {
      cast.connect();
    }
  };

  const handleStartCasting = () => {
    cast.loadMedia(mediaUrl, mediaTitle, mediaThumbnail, currentTime);
  };

  const handleDisconnect = () => {
    cast.disconnect();
  };

  const handleDLNADeviceSelect = (device: SavedDLNADevice) => {
    dlna.connectToDevice({
      id: device.id,
      name: device.name,
      type: 'dlna',
      location: `http://${device.ipAddress}:${device.port}/`,
    });
    
    if (mediaUrl) {
      setTimeout(() => {
        dlna.playMedia(mediaUrl, mediaTitle, currentTime);
      }, 500);
    }
  };

  const handleDLNADisconnect = () => {
    dlna.disconnect();
  };

  const isConnected = cast.isConnected || dlna.connectedDevice || airplay.isConnected;
  const deviceName = cast.deviceName || dlna.connectedDevice?.name || airplay.deviceName;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={handleCastClick}
            className={cn(
              'p-2 rounded-full transition-colors',
              isConnected 
                ? 'text-primary bg-primary/20 hover:bg-primary/30' 
                : 'text-foreground hover:text-primary hover:bg-muted',
              className
            )}
            title={isConnected ? `Casting to ${deviceName}` : 'Cast to device'}
          >
            <Cast className={cn("h-5 w-5", isConnected && "fill-current")} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card min-w-[260px]">
          {/* Scan Header */}
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">Cast Devices</span>
            <button
              onClick={handleScanForDevices}
              disabled={isScanning}
              className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-50"
              title="Scan for devices"
            >
              <RefreshCw className={cn(
                "h-3.5 w-3.5 text-muted-foreground",
                isScanning && "animate-spin"
              )} />
            </button>
          </div>
          
          <DropdownMenuSeparator />

          {/* Google Cast / Chromecast Section */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Cast className="h-3 w-3" />
            Chromecast
          </div>
          {cast.isConnected ? (
            <>
              <div className="px-2 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-foreground font-medium">{cast.deviceName}</span>
                </div>
                <span className="text-xs text-muted-foreground">Connected</span>
              </div>
              {mediaUrl && (
                <DropdownMenuItem onClick={handleStartCasting} className="cursor-pointer">
                  <Cast className="mr-2 h-4 w-4" />
                  Cast this video
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer text-destructive">
                Disconnect
              </DropdownMenuItem>
            </>
          ) : cast.isAvailable ? (
            <DropdownMenuItem onClick={() => cast.connect()} className="cursor-pointer">
              <Cast className="mr-2 h-4 w-4" />
              Connect to Chromecast
            </DropdownMenuItem>
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Wifi className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground/80">No Chromecast found</p>
                  <p className="mt-0.5">Make sure your Chromecast is on the same WiFi network. Use Chrome browser for best compatibility.</p>
                </div>
              </div>
            </div>
          )}

          <DropdownMenuSeparator />

          {/* DLNA Section */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Tv className="h-3 w-3" />
            Smart TV (DLNA/UPnP)
          </div>
          
          {dlna.connectedDevice ? (
            <>
              <div className="px-2 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-foreground font-medium">{dlna.connectedDevice.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">Connected</span>
              </div>
              {mediaUrl && (
                <DropdownMenuItem 
                  onClick={() => dlna.playMedia(mediaUrl, mediaTitle, currentTime)} 
                  className="cursor-pointer"
                >
                  <Tv className="mr-2 h-4 w-4" />
                  Play on TV
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDLNADisconnect} className="cursor-pointer text-destructive">
                Disconnect
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {savedDLNADevices.length > 0 ? (
                savedDLNADevices.slice(0, 3).map((device) => (
                  <DropdownMenuItem 
                    key={device.id}
                    onClick={() => handleDLNADeviceSelect(device)} 
                    className="cursor-pointer"
                  >
                    <Tv className="mr-2 h-4 w-4" />
                    {device.name}
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No saved Smart TVs
                </div>
              )}
              <DropdownMenuItem 
                onClick={() => setShowDLNASetup(true)} 
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                {savedDLNADevices.length > 0 ? 'Manage Devices...' : 'Add Smart TV...'}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          {/* AirPlay Section */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Airplay className="h-3 w-3" />
            AirPlay (Apple TV)
          </div>
          
          {airplay.isConnected ? (
            <>
              <div className="px-2 py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-foreground font-medium">{airplay.deviceName}</span>
                </div>
                <span className="text-xs text-muted-foreground">Connected via AirPlay</span>
              </div>
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Use your device's Control Center to disconnect
              </div>
            </>
          ) : airplay.isAvailable ? (
            <DropdownMenuItem onClick={() => airplay.showPicker()} className="cursor-pointer">
              <Airplay className="mr-2 h-4 w-4" />
              Select AirPlay Device
            </DropdownMenuItem>
          ) : (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              AirPlay requires Safari browser on Mac or iOS
            </div>
          )}

          <DropdownMenuSeparator />
          
          {/* Help Section */}
          <div className="px-2 py-2 text-[11px] text-muted-foreground/70">
            <p>💡 Tip: All devices must be on the same WiFi network to cast.</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DLNASetupGuide 
        open={showDLNASetup} 
        onOpenChange={setShowDLNASetup}
        onDeviceSelect={handleDLNADeviceSelect}
      />
    </>
  );
}
