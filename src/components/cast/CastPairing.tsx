import { useState, useRef, useEffect } from 'react';
import { QrCode, Keyboard, Loader2, Tv, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CastPairingProps {
  onPair: (code: string) => Promise<boolean>;
  isConnecting: boolean;
  error: string | null;
}

export function CastPairing({ onPair, isConnecting, error }: CastPairingProps) {
  const [mode, setMode] = useState<'choice' | 'scan' | 'code'>('choice');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleCodeSubmit = async () => {
    if (code.length !== 6) return;
    await onPair(code);
  };

  // QR Scanner setup
  const startScanner = async () => {
    try {
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        // Start scanning for QR codes
        scanForQR();
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setMode('code');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const scanForQR = async () => {
    if (!videoRef.current || !scanning) return;

    try {
      // Use jsQR library if available, otherwise fallback to code input
      const jsQR = (await import('jsqr')).default;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const scan = () => {
        if (!videoRef.current || !scanning || !ctx) return;
        
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (qrCode) {
          // Extract pairing code from QR data
          const match = qrCode.data.match(/code[=:]?([A-Z0-9]{6})/i) || 
                       qrCode.data.match(/([A-Z0-9]{6})/i);
          if (match) {
            stopScanner();
            onPair(match[1].toUpperCase());
            return;
          }
        }
        
        requestAnimationFrame(scan);
      };
      
      scan();
    } catch (err) {
      console.error('QR scanning not available:', err);
      setMode('code');
    }
  };

  useEffect(() => {
    if (mode === 'scan') {
      startScanner();
    } else {
      stopScanner();
    }
    
    return () => stopScanner();
  }, [mode]);

  if (mode === 'choice') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
            <Tv className="h-12 w-12 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Connect to your TV</h2>
          <p className="text-muted-foreground">
            Open <span className="font-mono text-primary">hoyeeh.com/tv</span> on your Smart TV browser
          </p>
        </div>

        <div className="grid gap-4">
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:border-primary",
              "active:scale-[0.98]"
            )}
            onClick={() => setMode('scan')}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Camera className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Scan QR Code</CardTitle>
                <CardDescription>Point your camera at the TV screen</CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className={cn(
              "cursor-pointer transition-all hover:border-primary",
              "active:scale-[0.98]"
            )}
            onClick={() => setMode('code')}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Keyboard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Enter Code</CardTitle>
                <CardDescription>Type the 6-character code from TV</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  if (mode === 'scan') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setMode('choice')}>
            <X className="h-4 w-4 mr-2" /> Cancel
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMode('code')}>
            Enter code manually
          </Button>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0 relative aspect-square bg-black">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-primary rounded-lg opacity-50" />
            </div>
            {scanning && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur px-4 py-2 rounded-full text-sm">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Scanning for QR code...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMode('choice')}>
          <X className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>

      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-full bg-primary/10 mb-2">
          <Keyboard className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Enter Pairing Code</h2>
        <p className="text-muted-foreground text-sm">
          Type the 6-character code shown on your TV
        </p>
      </div>

      <div className="space-y-4">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="ABC123"
          className="text-center text-2xl tracking-[0.5em] font-mono h-14"
          maxLength={6}
          autoFocus
          disabled={isConnecting}
        />

        {error && (
          <p className="text-destructive text-sm text-center">{error}</p>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={handleCodeSubmit}
          disabled={code.length !== 6 || isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            'Connect'
          )}
        </Button>
      </div>
    </div>
  );
}
