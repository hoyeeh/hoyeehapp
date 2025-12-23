import { useState, useEffect } from 'react';
import { Tv, QrCode, Loader2, X, Check, Wifi } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCast } from '@/contexts/CastContext';
import { toast } from 'sonner';

interface CastToTVButtonProps {
  videoUrl: string;
  videoTitle: string;
  videoThumbnail?: string;
  startTime?: number;
  duration?: number;
  className?: string;
}

// Simple QR code generator for displaying on screen
const generateQRCodeSVG = (data: string, size: number = 200): string => {
  // This is a simplified QR-like pattern for display
  // In production, you'd use a proper QR library
  const tvUrl = 'hoyeeh.com/tv';
  const encoded = btoa(data).slice(0, 20);
  
  // Create a visual pattern (not a real QR code, just for display)
  const cells = 21;
  const cellSize = size / cells;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;
  
  // Generate pattern based on data
  const pattern: boolean[][] = [];
  for (let y = 0; y < cells; y++) {
    pattern[y] = [];
    for (let x = 0; x < cells; x++) {
      // Corner markers
      const isCorner = 
        (x < 7 && y < 7) || 
        (x >= cells - 7 && y < 7) || 
        (x < 7 && y >= cells - 7);
      
      if (isCorner) {
        const inCorner = 
          (x < 7 && y < 7 && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4))) ||
          (x >= cells - 7 && y < 7 && (x === cells - 1 || x === cells - 7 || y === 0 || y === 6 || (x >= cells - 5 && x <= cells - 3 && y >= 2 && y <= 4))) ||
          (x < 7 && y >= cells - 7 && (x === 0 || x === 6 || y === cells - 1 || y === cells - 7 || (x >= 2 && x <= 4 && y >= cells - 5 && y <= cells - 3)));
        pattern[y][x] = inCorner;
      } else {
        // Data cells - generate based on data hash
        const hash = (data.charCodeAt(x % data.length) || 0) + (data.charCodeAt(y % data.length) || 0) + x * y;
        pattern[y][x] = (hash % 3) === 0;
      }
    }
  }
  
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (pattern[y][x]) {
        svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }
  
  svg += '</svg>';
  return svg;
};

export function CastToTVButton({
  videoUrl,
  videoTitle,
  videoThumbnail,
  startTime = 0,
  duration,
  className,
}: CastToTVButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [error, setError] = useState('');
  const cast = useCast();
  
  const tvReceiverUrl = 'hoyeeh.com/tv';
  const qrCodeData = `hoyeeh://pair?url=${encodeURIComponent(tvReceiverUrl)}`;

  const handlePair = async () => {
    if (pairingCode.length !== 6) {
      setError('Please enter a 6-character code');
      return;
    }

    setError('');
    const success = await cast.pairWithCode(pairingCode.toUpperCase());
    
    if (success) {
      toast.success('Connected to TV!');
      // Load the video on the TV
      await cast.loadVideo(videoUrl, videoTitle, videoThumbnail, duration, startTime);
      setShowDialog(false);
      setPairingCode('');
    } else {
      setError('Invalid or expired code. Please try again.');
    }
  };

  const handleCodeChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setPairingCode(cleaned);
    setError('');
  };

  // If already connected, show connected state
  if (cast.isConnected && cast.connectedDevice) {
    return (
      <button
        onClick={() => setShowDialog(true)}
        className={cn(
          "p-2 rounded-full transition-colors text-primary bg-primary/20 hover:bg-primary/30",
          className
        )}
        title={`Connected to ${cast.connectedDevice.name}`}
      >
        <Tv className="h-5 w-5 fill-current" />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className={cn(
          "p-2 rounded-full transition-colors hover:text-primary hover:bg-muted",
          className
        )}
        title="Cast to TV"
      >
        <Tv className="h-5 w-5" />
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5 text-primary" />
              Cast to TV
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Connection Status */}
            {cast.isConnected && cast.connectedDevice && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-primary">Connected</p>
                  <p className="text-sm text-muted-foreground">{cast.connectedDevice.name}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    cast.disconnect();
                    toast.info('Disconnected from TV');
                  }}
                >
                  Disconnect
                </Button>
              </div>
            )}

            {/* Step 1: Open TV App */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  1
                </span>
                Open on your Smart TV
              </div>
              
              <div className="ml-8">
                <div className="relative rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 p-6">
                  {/* QR Code Display */}
                  <div className="flex flex-col items-center gap-4">
                    <div 
                      className="w-40 h-40 bg-white rounded-xl p-3 shadow-lg"
                      dangerouslySetInnerHTML={{ 
                        __html: generateQRCodeSVG(qrCodeData, 140) 
                      }}
                    />
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Or visit</p>
                      <div className="px-4 py-2 rounded-lg bg-card border border-border">
                        <span className="text-lg font-bold text-primary tracking-wide">
                          {tvReceiverUrl}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Enter Code */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                  2
                </span>
                Enter the code from your TV
              </div>
              
              <div className="ml-8 space-y-3">
                <Input
                  value={pairingCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="ABC123"
                  className="text-center text-2xl tracking-[0.5em] font-mono uppercase h-14"
                  maxLength={6}
                  disabled={cast.isConnecting}
                />
                
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                
                <Button
                  onClick={handlePair}
                  className="w-full"
                  disabled={pairingCode.length !== 6 || cast.isConnecting}
                >
                  {cast.isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wifi className="mr-2 h-4 w-4" />
                      Connect & Play
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Previously Paired Devices */}
            {cast.pairedDevices.length > 0 && !cast.isConnected && (
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Previously connected</p>
                <div className="space-y-2">
                  {cast.pairedDevices.slice(0, 3).map((device) => (
                    <button
                      key={device.id}
                      onClick={async () => {
                        const success = await cast.reconnectToDevice(device);
                        if (success) {
                          await cast.loadVideo(videoUrl, videoTitle, videoThumbnail, duration, startTime);
                          setShowDialog(false);
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
                    >
                      <Tv className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{device.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
