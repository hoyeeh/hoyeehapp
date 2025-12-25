import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Loader2, AlertCircle, FlashlightOff, Flashlight, Keyboard } from "lucide-react";
import jsQR from "jsqr";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }, []);

  // Success sound using Web Audio API
  const playSuccessSound = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Play a pleasant success tone
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      console.log("[QRScanner] Audio not supported");
    }
  }, []);

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

  const extractCodeFromQRData = useCallback((qrData: string): string | null => {
    console.log("[QRScanner] Raw QR data:", qrData);
    
    // Try URL format: https://hoyeeh.com/tv?code=ABC123 or similar
    try {
      const url = new URL(qrData);
      const codeParam = url.searchParams.get("code") || url.searchParams.get("c");
      if (codeParam) {
        console.log("[QRScanner] Extracted code from URL param:", codeParam);
        return codeParam.toUpperCase();
      }
      // Check for code in path: /tv/ABC123
      const pathMatch = url.pathname.match(/\/tv\/([A-Z0-9]{4,8})$/i);
      if (pathMatch) {
        console.log("[QRScanner] Extracted code from URL path:", pathMatch[1]);
        return pathMatch[1].toUpperCase();
      }
    } catch {
      // Not a URL, continue with other formats
    }

    // Try prefix format: "HOYEEH:CODE123"
    if (qrData.startsWith("HOYEEH:")) {
      const code = qrData.replace("HOYEEH:", "").trim();
      console.log("[QRScanner] Extracted code from HOYEEH prefix:", code);
      return code.toUpperCase();
    }

    // Try plain code format (alphanumeric, 4-8 chars)
    const trimmed = qrData.trim();
    if (/^[A-Z0-9]{4,8}$/i.test(trimmed)) {
      console.log("[QRScanner] Plain code detected:", trimmed);
      return trimmed.toUpperCase();
    }

    console.log("[QRScanner] Could not extract valid code from:", qrData);
    return null;
  }, []);

  const handleSuccessfulScan = useCallback((code: string) => {
    console.log("[QRScanner] Valid pairing code found:", code);
    
    // Trigger haptic feedback and sound
    triggerHaptic();
    playSuccessSound();
    
    stopCamera();
    onCodeScanned(code);
  }, [triggerHaptic, playSuccessSound, stopCamera, onCodeScanned]);

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
      inversionAttempts: "attemptBoth",
    });

    if (code && code.data) {
      const pairingCode = extractCodeFromQRData(code.data);
      if (pairingCode) {
        handleSuccessfulScan(pairingCode);
        return;
      }
    }

    animationRef.current = requestAnimationFrame(scanQRCode);
  }, [extractCodeFromQRData, handleSuccessfulScan]);

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

  const handleManualSubmit = useCallback(() => {
    const code = manualCode.trim().toUpperCase();
    if (code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
      toast.error("Please enter a valid 6-character code");
      return;
    }
    
    triggerHaptic();
    playSuccessSound();
    stopCamera();
    onCodeScanned(code);
  }, [manualCode, triggerHaptic, playSuccessSound, stopCamera, onCodeScanned]);

  useEffect(() => {
    if (open) {
      startCamera();
      setShowManualEntry(false);
      setManualCode("");
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
                onClick={() => setShowManualEntry(true)}
                className="mt-2 px-6 py-3 bg-primary/20 text-primary rounded-xl font-medium border border-primary/30"
              >
                Enter Code Manually
              </button>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-3 bg-primary text-white rounded-xl font-medium"
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
        {hasCamera && !isLoading && !showManualEntry && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: '220px' }}>
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

        {/* Manual Entry Modal */}
        <AnimatePresence>
          {showManualEntry && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 p-6"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border"
              >
                <h3 className="text-xl font-bold text-foreground mb-2">Enter Code Manually</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Enter the 6-character code shown on your TV
                </p>
                
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="ABC123"
                  className="text-center text-2xl font-mono tracking-widest h-14 mb-4"
                  maxLength={6}
                  autoFocus
                />
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowManualEntry(false);
                      setManualCode("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleManualSubmit}
                    disabled={manualCode.length !== 6}
                  >
                    Connect
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions at bottom */}
        {!showManualEntry && (
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-safe z-10">
            <div className="bg-card/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-border/50 mb-2">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold text-xs">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">On your TV, go to:</p>
                  <p className="text-sm font-bold text-primary">hoyeeh.com/tv</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold text-xs">2</span>
                </div>
                <p className="text-xs text-foreground">Point camera at the QR code</p>
              </div>
              
              {/* Manual entry button */}
              <button
                onClick={() => setShowManualEntry(true)}
                className="w-full mt-3 py-2.5 flex items-center justify-center gap-2 bg-muted/50 hover:bg-muted rounded-xl transition-colors"
              >
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Enter code manually</span>
              </button>
            </div>
            <p className="text-white/60 text-xs text-center">
              Make sure your TV and phone are on the same WiFi network
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
