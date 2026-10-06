import { useEffect } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useKidsTimeLimit } from "@/hooks/useKidsTimeLimit";
import { useBedtimeMode } from "@/hooks/useBedtimeMode";

type KidsDesktopVideoPlayerProps = Omit<React.ComponentProps<typeof VideoPlayer>,
  "isKidsMode" | "kidsTimeRemaining" | "kidsTimeLimitReached" | "kidsBedtimeReached" | "kidsBedtimeTime"
>;

export function KidsDesktopVideoPlayer(props: KidsDesktopVideoPlayerProps) {
  const { timeRemaining, isTimeLimitReached, incrementWatchedTime } = useKidsTimeLimit();
  const { isBedtime, bedtimeTime } = useBedtimeMode();

  useEffect(() => {
    if (isTimeLimitReached || isBedtime) return;
    const timer = window.setInterval(() => incrementWatchedTime(1), 60000);
    return () => window.clearInterval(timer);
  }, [incrementWatchedTime, isBedtime, isTimeLimitReached]);

  return (
    <VideoPlayer
      {...props}
      isKidsMode
      kidsTimeRemaining={timeRemaining}
      kidsTimeLimitReached={isTimeLimitReached}
      kidsBedtimeReached={isBedtime}
      kidsBedtimeTime={bedtimeTime}
    />
  );
}