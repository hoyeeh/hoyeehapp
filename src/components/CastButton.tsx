import { Cast, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGoogleCast } from '@/hooks/useGoogleCast';
import { useEffect } from 'react';

interface CastButtonProps {
  mediaUrl?: string;
  mediaTitle?: string;
  mediaThumbnail?: string;
  currentTime?: number;
  className?: string;
  onCastStart?: () => void;
  onCastEnd?: () => void;
}

export function CastButton({
  mediaUrl,
  mediaTitle,
  mediaThumbnail,
  currentTime = 0,
  className,
  onCastStart,
  onCastEnd,
}: CastButtonProps) {
  const cast = useGoogleCast({
    mediaUrl,
    mediaTitle,
    mediaThumbnail,
  });

  useEffect(() => {
    if (cast.isConnected) {
      onCastStart?.();
    } else {
      onCastEnd?.();
    }
  }, [cast.isConnected, onCastStart, onCastEnd]);

  const handleCastClick = () => {
    if (cast.isConnected) {
      // Already connected - show options
    } else {
      cast.connect();
    }
  };

  const handleStartCasting = () => {
    cast.loadMedia(mediaUrl, mediaTitle, mediaThumbnail, currentTime);
  };

  const handleDisconnect = () => {
    cast.disconnect();
  };

  if (!cast.isAvailable) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={handleCastClick}
          className={cn(
            'p-2 rounded-full transition-colors',
            cast.isConnected 
              ? 'text-brand bg-brand/20 hover:bg-brand/30' 
              : 'text-foreground hover:text-brand hover:bg-muted',
            className
          )}
          title={cast.isConnected ? `Casting to ${cast.deviceName}` : 'Cast to device'}
        >
        <Cast className={cn("h-5 w-5", cast.isConnected && "fill-current")} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card min-w-[200px]">
        {cast.isConnected ? (
          <>
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Connected to <span className="text-foreground font-medium">{cast.deviceName}</span>
            </div>
            {mediaUrl && (
              <DropdownMenuItem onClick={handleStartCasting} className="cursor-pointer">
                <Cast className="mr-2 h-4 w-4" />
                Cast this video
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer text-destructive">
              Disconnect
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={() => cast.connect()} className="cursor-pointer">
            <Cast className="mr-2 h-4 w-4" />
            Connect to Cast device
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
