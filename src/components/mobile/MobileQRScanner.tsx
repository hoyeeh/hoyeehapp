import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Loader2, AlertCircle, FlashlightOff, Flashlight, Keyboard, Check, Settings, RefreshCw } from "lucide-react";
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [scannedCode, setScannedCode] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);

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
      setPermissionDenied(false);
      
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
    } catch (error: any) {
      console.error("[QRScanner] Camera error:", error);
      setHasCamera(false);
      setIsLoading(false);
      
      // Check if permission was denied
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }
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
    
    // Show success animation
    setScannedCode(code);
    setShowSuccess(true);
    
    // After animation, call onCodeScanned
    setTimeout(() => {
      onCodeScanned(code);
    }, 1200);
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
    
    // Show success animation
    setScannedCode(code);
    setShowSuccess(true);
    setShowManualEntry(false);
    
    // After animation, call onCodeScanned
    setTimeout(() => {
      onCodeScanned(code);
    }, 1200);
  }, [manualCode, triggerHaptic, playSuccessSound, stopCamera, onCodeScanned]);

  const retryCamera = useCallback(() => {
    setHasCamera(true);
    setPermissionDenied(false);
    startCamera();
  }, [startCamera]);

  useEffect(() => {
    if (open) {
      startCamera();
      setShowManualEntry(false);
      setManualCode("");
      setShowSuccess(false);
      setScannedCode("");
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

          {/* Camera Permission Denied Dialog */}
          {!hasCamera && !isLoading && permissionDenied && (
            <div className="flex flex-col items-center gap-4 p-6 text-center max-w-sm">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-5 rounded-full bg-primary/20 border-2 border-primary/30"
              >
                <Camera className="h-12 w-12 text-primary" />
              </motion.div>
              
              <h3 className="text-xl font-bold text-white">Camera Access Required</h3>
              
              <p className="text-white/70 text-sm">
                To scan QR codes, please allow camera access in your browser settings.
              </p>
              
              <div className="bg-white/10 rounded-xl p-4 w-full text-left">
                <p className="text-white/90 text-sm font-medium mb-2">How to enable:</p>
                <ol className="text-white/70 text-xs space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-primary/30 text-primary rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                    <span>Tap the lock/info icon in your browser's address bar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-primary/30 text-primary rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                    <span>Find "Camera" in the permissions list</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-primary/30 text-primary rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                    <span>Change from "Block" to "Allow"</span>
                  </li>
                </ol>
              </div>
              
              <div className="flex flex-col gap-2 w-full mt-2">
                <Button
                  onClick={retryCamera}
                  className="w-full gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowManualEntry(true)}
                  className="w-full gap-2"
                >
                  <Keyboard className="h-4 w-4" />
                  Enter Code Manually
                </Button>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="w-full text-white/60"
                >
                  Go Back
                </Button>
              </div>
            </div>
          )}

          {/* Generic Camera Error */}
          {!hasCamera && !isLoading && !permissionDenied && (
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="p-4 rounded-full bg-destructive/20">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-white">Camera not available</h3>
              <p className="text-white/70">
                Unable to access camera. Please check your device settings.
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
        {hasCamera && !isLoading && !showManualEntry && !showSuccess && (
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

        {/* Success Animation Overlay */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/90"
            >
              <div className="flex flex-col items-center gap-6">
                {/* Animated Checkmark Circle */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 200, 
                    damping: 15,
                    delay: 0.1
                  }}
                  className="relative"
                >
                  {/* Outer ring pulse */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ 
                      duration: 0.8, 
                      repeat: 2,
                      repeatType: "loop"
                    }}
                    className="absolute inset-0 rounded-full bg-green-500/30"
                  />
                  
                  {/* Main circle */}
                  <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center">
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 20,
                        delay: 0.3
                      }}
                    >
                      <Check className="h-12 w-12 text-white stroke-[3]" />
                    </motion.div>
                  </div>
                </motion.div>
                
                {/* Success Text */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-center"
                >
                  <h3 className="text-2xl font-bold text-white mb-2">QR Code Scanned!</h3>
                  <p className="text-white/70">Connecting to TV...</p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-primary font-mono text-xl mt-3 tracking-widest"
                  >
                    {scannedCode}
                  </motion.p>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Entry Modal */}
        <AnimatePresence>
          {showManualEntry && !showSuccess && (
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
        {!showManualEntry && !showSuccess && hasCamera && !isLoading && (
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
