import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Signal, SignalLow, SignalMedium, SignalHigh } from "lucide-react";
import { NetworkQuality } from "@/hooks/useNetworkQuality";

interface NetworkQualityIndicatorProps {
  network: NetworkQuality;
  currentQuality: string;
  isVisible: boolean;
}

export const NetworkQualityIndicator = ({
  network,
  currentQuality,
  isVisible,
}: NetworkQualityIndicatorProps) => {
  const getSignalIcon = () => {
    if (!network.isOnline) {
      return <WifiOff className="h-3.5 w-3.5 text-destructive" />;
    }
    
    switch (network.effectiveType) {
      case '4g':
        return <SignalHigh className="h-3.5 w-3.5 text-green-500" />;
      case '3g':
        return <SignalMedium className="h-3.5 w-3.5 text-yellow-500" />;
      case '2g':
      case 'slow-2g':
        return <SignalLow className="h-3.5 w-3.5 text-orange-500" />;
      default:
        return <Signal className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getConnectionLabel = () => {
    if (!network.isOnline) return 'Offline';
    
    switch (network.effectiveType) {
      case '4g':
        return 'Excellent';
      case '3g':
        return 'Good';
      case '2g':
        return 'Fair';
      case 'slow-2g':
        return 'Poor';
      default:
        return 'Unknown';
    }
  };

  const getQualityLabel = () => {
    if (currentQuality === 'auto') return 'Auto';
    return `${currentQuality}p`;
  };

  const getConnectionColor = () => {
    if (!network.isOnline) return 'bg-destructive/20 border-destructive/30';
    
    switch (network.effectiveType) {
      case '4g':
        return 'bg-green-500/10 border-green-500/20';
      case '3g':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case '2g':
      case 'slow-2g':
        return 'bg-orange-500/10 border-orange-500/20';
      default:
        return 'bg-muted/50 border-border';
    }
  };

  return (
    <div
      className={cn(
        "absolute top-16 right-4 z-30 transition-all duration-300 ease-out",
        isVisible 
          ? "opacity-100 translate-y-0" 
          : "opacity-0 -translate-y-2 pointer-events-none"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md",
          getConnectionColor()
        )}
      >
        {getSignalIcon()}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-foreground/80">{getConnectionLabel()}</span>
          <span className="text-muted-foreground">•</span>
          <span className="font-medium text-foreground">{getQualityLabel()}</span>
        </div>
        {network.downlink > 0 && network.isOnline && (
          <>
            <span className="text-muted-foreground text-xs">•</span>
            <span className="text-xs text-muted-foreground">
              {network.downlink.toFixed(1)} Mbps
            </span>
          </>
        )}
      </div>
    </div>
  );
};
