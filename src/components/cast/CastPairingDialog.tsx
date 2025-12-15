import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tv, Loader2, Link2, ExternalLink, Smartphone, Camera, X } from 'lucide-react';
import { toast } from 'sonner';

interface CastPairingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPair: (code: string) => Promise<boolean>;
  isConnecting: boolean;
}

export function CastPairingDialog({
  open,
  onOpenChange,
  onPair,
  isConnecting,
}: CastPairingDialogProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Start camera for QR scanning
  const startCamera = async () => {
    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Camera not supported on this device');
        return;
      }
      
      // Request camera permission with proper constraints
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be ready before playing
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.error('Video play error:', err);
          });
        };
      }
      setShowScanner(true);
      startScanning();
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        toast.error('No camera found on this device');
      } else if (err.name === 'NotSupportedError' || err.name === 'TypeError') {
        toast.error('Camera not supported. Please use HTTPS or localhost.');
      } else {
        toast.error('Failed to access camera. Please try again.');
      }
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setShowScanner(false);
  };

  // Scan QR code from video feed
  const startScanning = () => {
    // Check if BarcodeDetector is available
    const hasBarcodeDetector = 'BarcodeDetector' in window;
    
    if (!hasBarcodeDetector) {
      toast.info('QR scanning not fully supported. Please enter the code manually.');
    }
    
    scanIntervalRef.current = window.setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;
      
      // Ensure video has valid dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Use BarcodeDetector API if available
      if (hasBarcodeDetector) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          barcodeDetector.detect(canvas).then((barcodes: any[]) => {
            if (barcodes.length > 0) {
              const qrData = barcodes[0].rawValue;
              handleQRCode(qrData);
            }
          }).catch((err: any) => {
            // Silently handle detection errors
            console.debug('Barcode detection error:', err);
          });
        } catch (err) {
          console.debug('BarcodeDetector error:', err);
        }
      }
    }, 500);
  };

  // Handle detected QR code
  const handleQRCode = (data: string) => {
    // Expected format: hoyeeh://pair?code=ABC123
    const match = data.match(/code=([A-Z0-9]{6})/i);
    if (match) {
      const extractedCode = match[1].toUpperCase();
      setCode(extractedCode);
      stopCamera();
      toast.success('QR code detected!');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Cleanup when dialog closes
  useEffect(() => {
    if (!open) {
      stopCamera();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError('Please enter a 6-character code');
      return;
    }

    const success = await onPair(code);
    if (success) {
      setCode('');
      onOpenChange(false);
    } else {
      setError('Invalid or expired code. Please try again.');
    }
  };

  const handleCodeChange = (value: string) => {
    // Only allow alphanumeric characters, uppercase
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    setError('');
  };

  const tvReceiverUrl = 'https://hoyeeh.com/tv-receiver/';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            Link with TV Code
          </DialogTitle>
          <DialogDescription>
            Connect to your Smart TV to cast videos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Open TV Receiver */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                1
              </span>
              Open the TV Receiver on your Smart TV
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-sm text-muted-foreground">
                On your Smart TV's browser, go to:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                  {tvReceiverUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(tvReceiverUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2: Enter Code */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                2
              </span>
              Enter the code shown on your TV
            </div>
            <form onSubmit={handleSubmit} className="ml-8 space-y-3">
              <Input
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="ABC123"
                className="text-center text-2xl tracking-[0.5em] font-mono uppercase"
                maxLength={6}
                autoFocus
                disabled={isConnecting}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={code.length !== 6 || isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Connect to TV
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* QR Code Scanner */}
          <div className="border-t pt-4">
            {showScanner ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Scanning for QR code...</span>
                  <Button variant="ghost" size="sm" onClick={stopCamera}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                  <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 border-2 border-primary/50 m-8 rounded-lg" />
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={startCamera}
              >
                <Camera className="mr-2 h-4 w-4" />
                Scan QR Code from TV
              </Button>
            )}
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Point your camera at the QR code displayed on your TV
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}