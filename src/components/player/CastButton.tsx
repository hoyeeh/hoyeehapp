/**
 * CastButton - Unified cast button for player UI
 * 
 * Opens the UnifiedCastSheet with all cast options
 */

import { useState } from "react";
import { Cast, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UnifiedCastSheet } from "./UnifiedCastSheet";
import { useCast } from "@/contexts/CastContext";

interface CastButtonProps {
  videoUrl: string;
  videoTitle: string;
  videoThumbnail?: string;
  videoDuration?: number;
  onOpenFullscreen?: () => void;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "ghost" | "outline";
  isKidsMode?: boolean;
  showCastEnabled?: boolean; // For kids mode parental control
}

export function CastButton({
  videoUrl,
  videoTitle,
  videoThumbnail,
  videoDuration,
  onOpenFullscreen,
  className,
  size = "icon",
  variant = "ghost",
  isKidsMode = false,
  showCastEnabled = false,
}: CastButtonProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const cast = useCast();
  
  // Check if any cast is active
  const isAnyCastActive = cast.chromecast?.isConnected || 
                          cast.airPlay?.isConnected || 
                          cast.dlna?.connectedDevice !== null;

  // Don't show in kids mode unless explicitly enabled
  if (isKidsMode && !showCastEnabled) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          setIsSheetOpen(true);
        }}
        className={cn(
          "text-white hover:text-white/80",
          isAnyCastActive && "text-primary hover:text-primary/80",
          className
        )}
      >
        {isAnyCastActive ? (
          <Tv className="h-5 w-5" />
        ) : (
          <Cast className="h-5 w-5" />
        )}
      </Button>

      <UnifiedCastSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        videoUrl={videoUrl}
        videoTitle={videoTitle}
        videoThumbnail={videoThumbnail}
        videoDuration={videoDuration}
        onOpenFullscreen={onOpenFullscreen}
        isKidsMode={isKidsMode}
      />
    </>
  );
}
