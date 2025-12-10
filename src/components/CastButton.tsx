import { useState } from 'react';
import { Cast, Tv, Settings, Loader2, AlertCircle } from 'lucide-react';
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
import { DLNASetupGuide } from '@/components/DLNASetupGuide';
import { useEffect } from 'react';

interface CastButtonProps {
  mediaUrl?: string;
  mediaTitle?: string;
  mediaThumbnail?: string;
  currentTime?: number;
  className?: string;
  onCastStart?: () => void;
  onCastEnd?: () => void;
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
}: CastButtonProps) {
  const [showDLNASetup, setShowDLNASetup] = useState(false);
  const [savedDLNADevices, setSavedDLNADevices] = useState<SavedDLNADevice[]>([]);
  
  const cast = useGoogleCast({
    mediaUrl,
    mediaTitle,
    mediaThumbnail,
  });
  
  const dlna = useDLNA();

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

  const isConnected = cast.isConnected || dlna.connectedDevice;
  const deviceName = cast.deviceName || dlna.connectedDevice?.name;

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
        <DropdownMenuContent align="end" className="bg-card min-w-[220px]">
          {/* Google Cast Section */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Google Cast
          </div>
          {cast.isConnected ? (
            <>
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Connected to <span className="text-foreground font-medium">{cast.deviceName}</span>
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
            <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              <span>No Cast devices found. Use Chrome browser with Chromecast on the same network.</span>
            </div>
          )}

          <DropdownMenuSeparator />

          {/* DLNA Section */}
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            DLNA/UPnP (Smart TVs)
          </div>
          
          {dlna.connectedDevice ? (
            <>
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Connected to <span className="text-foreground font-medium">{dlna.connectedDevice.name}</span>
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
              {savedDLNADevices.slice(0, 3).map((device) => (
                <DropdownMenuItem 
                  key={device.id}
                  onClick={() => handleDLNADeviceSelect(device)} 
                  className="cursor-pointer"
                >
                  <Tv className="mr-2 h-4 w-4" />
                  {device.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem 
                onClick={() => setShowDLNASetup(true)} 
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                {savedDLNADevices.length > 0 ? 'Manage Devices...' : 'Setup DLNA Devices...'}
              </DropdownMenuItem>
            </>
          )}
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
