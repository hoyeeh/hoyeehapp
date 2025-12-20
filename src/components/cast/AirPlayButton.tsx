import { useEffect } from "react";
import { Airplay, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAirPlay } from "@/hooks/useAirPlay";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AirPlayButtonProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  onConnect?: () => void;
  onDisconnect?: () => void;
  className?: string;
  variant?: "icon" | "full";
}

export function AirPlayButton({
  videoRef,
  onConnect,
  onDisconnect,
  className,
  variant = "icon",
}: AirPlayButtonProps) {
  const airplay = useAirPlay({
    onConnect,
    onDisconnect,
  });

  // Set up video element when ref changes
  useEffect(() => {
    if (videoRef?.current) {
      airplay.setupVideo(videoRef.current);
    }
  }, [videoRef?.current, airplay.setupVideo]);

  // Check connection status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      airplay.checkConnection();
    }, 2000);
    return () => clearInterval(interval);
  }, [airplay.checkConnection]);

  if (!airplay.isAvailable) {
    if (variant === "icon") {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("opacity-50 cursor-not-allowed", className)}
                disabled
              >
                <Airplay className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>AirPlay requires Safari browser</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return (
      <div className={cn("p-4 bg-muted/20 rounded-xl", className)}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium text-sm">AirPlay Unavailable</p>
            <p className="text-xs text-muted-foreground mt-1">
              AirPlay is only available in Safari on Mac and iOS devices.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => airplay.showPicker()}
              className={cn(
                airplay.isConnected && "text-primary bg-primary/10",
                className
              )}
            >
              <Airplay className={cn(
                "h-5 w-5",
                airplay.isConnected && "text-primary"
              )} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{airplay.isConnected ? `Connected to ${airplay.deviceName}` : 'AirPlay'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* AirPlay Header */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          airplay.isConnected 
            ? "bg-primary/20" 
            : "bg-muted/30"
        )}>
          <Airplay className={cn(
            "w-6 h-6",
            airplay.isConnected 
              ? "text-primary" 
              : "text-muted-foreground"
          )} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">AirPlay</h3>
          <p className="text-sm text-muted-foreground">
            {airplay.isConnected 
              ? `Connected to ${airplay.deviceName}` 
              : "Stream to Apple TV or AirPlay speakers"}
          </p>
        </div>
      </div>

      {/* Connection Status / Action */}
      {airplay.isConnected ? (
        <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium">Connected to {airplay.deviceName}</p>
              <p className="text-xs text-muted-foreground">Audio and video streaming active</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            To disconnect, use Control Center on your device or select a different output.
          </p>
        </div>
      ) : (
        <Button 
          onClick={() => airplay.showPicker()}
          className="w-full"
          variant="outline"
        >
          <Airplay className="w-4 h-4 mr-2" />
          Select AirPlay Device
        </Button>
      )}

      {/* Tips */}
      {!airplay.isConnected && (
        <div className="p-3 bg-muted/10 rounded-xl">
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> Make sure your Apple TV or AirPlay device is on the same WiFi network. 
            AirPlay works best with Safari browser.
          </p>
        </div>
      )}
    </div>
  );
}