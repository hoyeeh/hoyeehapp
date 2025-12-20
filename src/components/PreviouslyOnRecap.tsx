import { useState, useRef, useEffect } from "react";
import { X, Play, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviouslyOnRecapProps {
  videoUrl: string;
  episodeTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  recapStartTime: number;
  recapEndTime: number;
  onSkip: () => void;
  onComplete: () => void;
}

export const PreviouslyOnRecap = ({
  videoUrl,
  episodeTitle,
  seasonNumber,
  episodeNumber,
  recapStartTime,
  recapEndTime,
  onSkip,
  onComplete,
}: PreviouslyOnRecapProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = recapStartTime;

    const handleTimeUpdate = () => {
      const current = video.currentTime;
      const duration = recapEndTime - recapStartTime;
      const elapsed = current - recapStartTime;
      setProgress((elapsed / duration) * 100);

      // Auto-complete when recap ends
      if (current >= recapEndTime) {
        onComplete();
      }
    };

    const handleEnded = () => {
      onComplete();
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [recapStartTime, recapEndTime, onComplete]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Previously On...</h2>
            <p className="text-sm text-white/70">
              S{seasonNumber} E{episodeNumber - 1}: {episodeTitle}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-white hover:bg-white/20"
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Skip Recap
          </Button>
        </div>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        autoPlay
        onClick={togglePlay}
      />

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-white/70">Recap</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onSkip}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Skip to Episode
          </Button>
        </div>
      </div>
    </div>
  );
};
