import { useState } from 'react';
import { Cast, Tv, Link2, ChevronDown, Wifi, WifiOff, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CastPairingDialog } from './CastPairingDialog';
import { CastDeviceList } from './CastDeviceList';
import { useUniversalCast } from '@/hooks/useUniversalCast';
import { DLNASetupGuide } from '@/components/DLNASetupGuide';
import { cn } from '@/lib/utils';

interface UniversalCastButtonProps {
  videoUrl?: string;
  videoTitle?: string;
  thumbnail?: string;
  duration?: number;
  className?: string;
  variant?: 'default' | 'icon';
  onCastStart?: () => void;
  onCastEnd?: () => void;
}

export function UniversalCastButton({
  videoUrl,
  videoTitle,
  thumbnail,
  duration,
  className,
  variant = 'default',
  onCastStart,
  onCastEnd,
}: UniversalCastButtonProps) {
  const [showPairingDialog, setShowPairingDialog] = useState(false);
  const [showDLNASetup, setShowDLNASetup] = useState(false);

  const {
    isConnecting,
    isConnected,
    connectedDevice,
    pairedDevices,
    pairWithCode,
    reconnectToDevice,
    disconnect,
    removePairedDevice,
    loadVideo,
  } = useUniversalCast();

  const handlePair = async (code: string): Promise<boolean> => {
    const sessionId = await pairWithCode(code);
    if (sessionId) {
      onCastStart?.();
      // Auto-cast if we have a video - use sessionId directly to avoid race condition
      if (videoUrl && videoTitle) {
        setTimeout(() => {
          loadVideo(videoUrl, videoTitle, thumbnail, duration, undefined, sessionId);
        }, 300);
      }
      return true;
    }
    return false;
  };

  const handleReconnect = async (device: typeof pairedDevices[0]) => {
    const success = await reconnectToDevice(device);
    if (success) {
      onCastStart?.();
      // Auto-cast if we have a video
      if (videoUrl && videoTitle) {
        setTimeout(() => {
          loadVideo(videoUrl, videoTitle, thumbnail, duration);
        }, 500);
      }
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onCastEnd?.();
  };

  const handleCastNow = () => {
    if (isConnected && videoUrl && videoTitle) {
      loadVideo(videoUrl, videoTitle, thumbnail, duration);
    }
  };

  // Icon-only variant for compact displays
  if (variant === 'icon') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "relative",
                isConnected && "text-primary",
                className
              )}
            >
              <Cast className="h-5 w-5" />
              {isConnected && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {renderMenuContent()}
          </DropdownMenuContent>
        </DropdownMenu>

        <CastPairingDialog
          open={showPairingDialog}
          onOpenChange={setShowPairingDialog}
          onPair={handlePair}
          isConnecting={isConnecting}
        />

        <DLNASetupGuide
          open={showDLNASetup}
          onOpenChange={setShowDLNASetup}
        />
      </>
    );
  }

  function renderMenuContent() {
    return (
      <>
        {/* Connected device */}
        {isConnected && connectedDevice && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
              Connected to {connectedDevice.name}
            </DropdownMenuLabel>
            {videoUrl && (
              <DropdownMenuItem onClick={handleCastNow}>
                <Cast className="mr-2 h-4 w-4" />
                Cast Now
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDisconnect}>
              <WifiOff className="mr-2 h-4 w-4" />
              Disconnect
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Link with TV code */}
        <DropdownMenuItem onClick={() => setShowPairingDialog(true)}>
          <Link2 className="mr-2 h-4 w-4" />
          Link with TV code
        </DropdownMenuItem>

        {/* Paired devices */}
        {pairedDevices.length > 0 && !isConnected && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Paired Devices</DropdownMenuLabel>
            {pairedDevices.slice(0, 3).map((device) => (
              <DropdownMenuItem
                key={device.id}
                onClick={() => handleReconnect(device)}
                disabled={isConnecting}
              >
                <Tv className="mr-2 h-4 w-4" />
                {device.name}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* DLNA Setup */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShowDLNASetup(true)}>
          <Settings className="mr-2 h-4 w-4" />
          Manual DLNA Setup
        </DropdownMenuItem>
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={isConnected ? "default" : "outline"}
            className={cn("gap-2", className)}
          >
            <Cast className="h-4 w-4" />
            {isConnected ? `Casting to ${connectedDevice?.name}` : 'Cast'}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {renderMenuContent()}
        </DropdownMenuContent>
      </DropdownMenu>

      <CastPairingDialog
        open={showPairingDialog}
        onOpenChange={setShowPairingDialog}
        onPair={handlePair}
        isConnecting={isConnecting}
      />

      <DLNASetupGuide
        open={showDLNASetup}
        onOpenChange={setShowDLNASetup}
      />
    </>
  );
}