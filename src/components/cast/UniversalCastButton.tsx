import { useState } from 'react';
import { Cast, Tv, Link2, ChevronDown, Wifi, WifiOff, } from 'lucide-react';
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
import { useCast } from '@/contexts/CastContext';
import type { CastDevice } from '@/hooks/useUniversalCast';
import { toast } from 'sonner';
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
  // True only after the TV acknowledged this exact LOAD.
  const [castingConfirmed, setCastingConfirmed] = useState(false);

  const {
    isConnecting,
    isConnected: linked,
    connectedDevice,
    pairedDevices,
    pairWithCode,
    reconnectToDevice,
    disconnect,
    loadVideo,
  } = useCast();
  const isConnected = linked && !!connectedDevice;

  const launch = async (sessionId?: string) => {
    if (!videoUrl || !videoTitle) return false;
    const result = await loadVideo(videoUrl, videoTitle, thumbnail, duration, undefined, sessionId);
    if (!result?.success) {
      setCastingConfirmed(false);
      // useUniversalCast already surfaces the reason; keep state honest.
      return false;
    }
    setCastingConfirmed(true);
    onCastStart?.();
    toast.success(`Casting "${videoTitle}" to TV`);
    return true;
  };

  const handlePair = async (code: string): Promise<boolean> => {
    const sessionId = await pairWithCode(code);
    if (!sessionId) return false;
    setShowPairingDialog(false);
    await launch(sessionId);
    return true;
  };

  const handleReconnect = async (device: CastDevice) => {
    if (!device.sessionId) {
      toast.error('Enter the code shown on your TV to pair again.');
      setShowPairingDialog(true);
      return;
    }
    const ok = await reconnectToDevice(device);
    if (!ok) { setShowPairingDialog(true); return; }
    await launch(device.sessionId);
  };

  const handleDisconnect = () => {
    disconnect();
    setCastingConfirmed(false);
    onCastEnd?.();
  };

  const handleCastNow = () => { void launch(); };

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
            {isConnected ? (castingConfirmed ? `Casting to ${connectedDevice?.name}` : `Connected to ${connectedDevice?.name}`) : 'Cast'}
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
    </>
  );
}