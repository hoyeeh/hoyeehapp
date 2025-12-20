import { useEffect, useRef } from 'react';
import { Cast } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleCast } from '@/hooks/useGoogleCast';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NativeCastButtonProps {
  videoUrl?: string;
  videoTitle?: string;
  videoThumbnail?: string;
  startTime?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  className?: string;
  variant?: 'icon' | 'full';
  showLabel?: boolean;
}

export function NativeCastButton({
  videoUrl,
  videoTitle,
  videoThumbnail,
  startTime = 0,
  onConnect,
  onDisconnect,
  className,
  variant = 'icon',
  showLabel = false,
}: NativeCastButtonProps) {
  const previousConnectedRef = useRef<boolean | null>(null);
  
  const googleCast = useGoogleCast({
    mediaUrl: videoUrl,
    mediaTitle: videoTitle,
    mediaThumbnail: videoThumbnail,
    onConnectionChange: (connected) => {
      if (previousConnectedRef.current !== connected) {
        previousConnectedRef.current = connected;
        if (connected) {
          onConnect?.();
        } else {
          onDisconnect?.();
        }
      }
    },
  });

  // Auto-load media when connected and media info is available
  useEffect(() => {
    if (googleCast.isConnected && videoUrl && videoTitle) {
      googleCast.loadMedia(videoUrl, videoTitle, videoThumbnail, startTime);
    }
  }, [googleCast.isConnected, videoUrl, videoTitle, videoThumbnail, startTime]);

  const handleClick = () => {
    if (googleCast.isConnected) {
      googleCast.disconnect();
    } else {
      googleCast.connect();
    }
  };

  // Determine button state
  const isActive = googleCast.isConnected;
  const isLoading = !googleCast.isInitialized;
  const isDisabled = !googleCast.isAvailable && googleCast.isInitialized;

  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick}
              disabled={isDisabled || isLoading}
              className={cn(
                'relative transition-all duration-200',
                isActive && 'text-primary bg-primary/10',
                isDisabled && 'opacity-50 cursor-not-allowed',
                className
              )}
            >
              <Cast 
                className={cn(
                  'h-5 w-5 transition-all',
                  isActive && 'text-primary',
                  isLoading && 'animate-pulse'
                )} 
              />
              {/* Connection indicator dot */}
              {isActive && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-primary rounded-full animate-pulse" />
              )}
              {/* Device discovery indicator */}
              {googleCast.isAvailable && !isActive && !isLoading && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-muted-foreground/50 rounded-full" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isLoading ? (
              <p>Discovering devices...</p>
            ) : isDisabled ? (
              <p>No Cast devices found</p>
            ) : isActive ? (
              <p>Connected to {googleCast.deviceName} • Click to disconnect</p>
            ) : (
              <p>Cast to TV</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full variant with label
  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      onClick={handleClick}
      disabled={isDisabled || isLoading}
      className={cn(
        'gap-2 transition-all duration-200',
        isActive && 'bg-primary text-primary-foreground',
        className
      )}
    >
      <Cast 
        className={cn(
          'h-4 w-4',
          isLoading && 'animate-pulse'
        )} 
      />
      {showLabel && (
        <span>
          {isLoading 
            ? 'Discovering...' 
            : isActive 
              ? `Casting to ${googleCast.deviceName}` 
              : 'Cast'
          }
        </span>
      )}
    </Button>
  );
}
