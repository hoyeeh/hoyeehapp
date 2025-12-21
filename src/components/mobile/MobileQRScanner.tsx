import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Loader2, AlertCircle, FlashlightOff, Flashlight } from "lucide-react";
import jsQR from "jsqr";
import { toast } from "sonner";

interface MobileQRScannerProps {
  open: boolean;
  onClose: () => void;
  onCodeScanned: (code: string) => void;
}

export function MobileQRScanner({ open, onClose, onCodeScanned }: MobileQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasCamera, setHasCamera] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check if torch is available
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.() as any;
      setHasTorch(capabilities?.torch === true);
      
      setIsLoading(false);
      setHasCamera(true);
      
      // Start scanning
      scanQRCode();
    } catch (error) {
      console.error("[QRScanner] Camera error:", error);
      setHasCamera(false);
      setIsLoading(false);
    }
  }, []);

  const scanQRCode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      // Extract pairing code from QR data
      // Expected formats: "HOYEEH:CODE123" or just "CODE123"
      let pairingCode = code.data;
      if (pairingCode.startsWith("HOYEEH:")) {
        pairingCode = pairingCode.replace("HOYEEH:", "");
      }
      
      // Validate it looks like a pairing code (alphanumeric, 4-8 chars)
      if (/^[A-Z0-9]{4,8}$/i.test(pairingCode)) {
        stopCamera();
        onCodeScanned(pairingCode.toUpperCase());
        return;
      }
    }

    animationRef.current = requestAnimationFrame(scanQRCode);
  }, [onCodeScanned, stopCamera]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as any]
      });
      setTorchOn(!torchOn);
    } catch (error) {
      console.error("[QRScanner] Torch error:", error);
    }
  }, [torchOn]);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[220] bg-black"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 pt-safe">
          <button
            onClick={onClose}
            className="p-3 rounded-full bg-black/50 backdrop-blur-sm active:scale-95 transition-all touch-manipulation"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <h2 className="text-lg font-semibold text-white">Scan QR Code</h2>
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className="p-3 rounded-full bg-black/50 backdrop-blur-sm active:scale-95 transition-all touch-manipulation"
            >
              {torchOn ? (
                <Flashlight className="h-6 w-6 text-yellow-400" />
              ) : (
                <FlashlightOff className="h-6 w-6 text-white" />
              )}
            </button>
          )}
          {!hasTorch && <div className="w-12" />}
        </div>

        {/* Camera view */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isLoading && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 text-white animate-spin" />
              <p className="text-white">Starting camera...</p>
            </div>
          )}

          {!hasCamera && !isLoading && (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="p-4 rounded-full bg-destructive/20">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-white">Camera not available</h3>
              <p className="text-white/70">
                Please allow camera access to scan QR codes
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-3 bg-primary text-white rounded-xl font-medium"
              >
                Go Back
              </button>
            </div>
          )}

          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Scanning overlay */}
        {hasCamera && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Darkened corners */}
            <div className="absolute inset-0 bg-black/50" />
            
            {/* Scanning area */}
            <div className="relative w-64 h-64">
              {/* Clear center */}
              <div className="absolute inset-0 bg-transparent" 
                style={{ 
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" 
                }} 
              />
              
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
              
              {/* Scanning line animation */}
              <motion.div
                className="absolute left-4 right-4 h-0.5 bg-primary"
                initial={{ top: "10%" }}
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pb-safe text-center">
          <p className="text-white/80 text-sm">
            Point your camera at the QR code on your TV screen
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
