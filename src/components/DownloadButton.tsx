import { Download, Check, Trash2, ChevronDown, X, Pause, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Content } from "@/types";
import { useDownloadManager } from "@/hooks/useDownloadManager";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

interface DownloadButtonProps {
  content: Content;
  episodeId?: string;
  episodeTitle?: string;
  variant?: "icon" | "button";
  className?: string;
}

const QUALITY_OPTIONS = [
  { value: "480p", label: "480p", size: "~500MB" },
  { value: "720p", label: "720p (HD)", size: "~1GB" },
  { value: "1080p", label: "1080p (Full HD)", size: "~2GB" },
] as const;

type QualityOption = typeof QUALITY_OPTIONS[number]["value"];

export const DownloadButton = ({
  content,
  episodeId,
  episodeTitle,
  variant = "button",
  className,
}: DownloadButtonProps) => {
  const { startDownload, pauseDownload, resumeDownload, cancelDownload, deleteDownload, isDownloaded, getProgress } = useDownloadManager();
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const downloaded = isDownloaded(content.id, episodeId);
  const progress = getProgress(content.id, episodeId);

  const handleQualitySelect = (quality: QualityOption) => {
    setShowQualityMenu(false);
    startDownload(content, episodeId, episodeTitle, quality);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloaded) {
      deleteDownload(content.id, episodeId);
    } else if (progress?.status === "downloading") {
      pauseDownload(content.id, episodeId);
    } else if (progress?.status === "paused") {
      resumeDownload(content.id, episodeId);
    } else if (!progress || progress.status === "failed") {
      setShowQualityMenu(true);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelDownload(content.id, episodeId);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const formatEta = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  if (variant === "icon") {
    return (
      <DropdownMenu open={showQualityMenu} onOpenChange={setShowQualityMenu}>
        <DropdownMenuTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
              downloaded
                ? "border-brand text-brand hover:bg-brand/10"
                : progress?.status === "downloading"
                ? "border-brand/50 text-brand"
                : progress?.status === "paused"
                ? "border-yellow-500/50 text-yellow-500"
                : "border-muted-foreground/50 text-foreground hover:border-foreground",
              className
            )}
            title={
              progress?.status === "downloading" && progress.speed 
                ? `${formatSpeed(progress.speed)} • ${formatEta(progress.eta || 0)} left` 
                : progress?.status === "paused"
                ? "Paused - Click to resume"
                : undefined
            }
          >
            {progress?.status === "downloading" ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <svg className="w-5 h-5 -rotate-90">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${(progress.progress / 100) * 50.26} 50.26`} className="transition-all duration-300" />
                </svg>
                <Pause className="absolute h-2 w-2" />
              </div>
            ) : progress?.status === "paused" ? (
              <PlayCircle className="h-3.5 w-3.5" />
            ) : downloaded ? (
              <Check className="h-3 w-3" />
            ) : (
              <Download className="h-3 w-3" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Select Quality</div>
          {QUALITY_OPTIONS.map((option) => (
            <DropdownMenuItem key={option.value} onClick={() => handleQualitySelect(option.value)} className="flex justify-between cursor-pointer">
              <span>{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.size}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex gap-2 items-center">
        <DropdownMenu open={showQualityMenu} onOpenChange={setShowQualityMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              onClick={handleClick}
              variant={downloaded ? "secondary" : progress?.status === "paused" ? "outline" : "secondary"}
              size="lg"
              className={cn("gap-2", progress?.status === "paused" && "border-yellow-500/50 text-yellow-500")}
            >
              {progress?.status === "downloading" ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause ({progress.progress}%)
                </>
              ) : progress?.status === "paused" ? (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Resume ({progress.progress}%)
                </>
              ) : downloaded ? (
                <>
                  <Trash2 className="h-4 w-4" />
                  Remove
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download
                  <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 bg-popover border-border">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Select Video Quality</div>
            {QUALITY_OPTIONS.map((option) => (
              <DropdownMenuItem key={option.value} onClick={() => handleQualitySelect(option.value)} className="flex justify-between cursor-pointer">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.size}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Cancel button for downloading/paused state */}
        {(progress?.status === "downloading" || progress?.status === "paused") && (
          <Button variant="ghost" size="lg" onClick={handleCancel} className="px-3">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Progress bar for downloading state */}
      {progress?.status === "downloading" && (
        <div className="space-y-1">
          <Progress value={progress.progress} className="h-1.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatSize(progress.downloadedSize)} / {formatSize(progress.totalSize)}</span>
            {progress.speed && progress.speed > 0 && (
              <span className="text-brand font-medium">{formatSpeed(progress.speed)}</span>
            )}
          </div>
          {progress.eta && progress.eta > 0 && (
            <div className="text-xs text-muted-foreground text-right">~{formatEta(progress.eta)} remaining</div>
          )}
        </div>
      )}

      {/* Paused indicator */}
      {progress?.status === "paused" && (
        <div className="text-xs text-yellow-500">
          Paused at {progress.progress}% • {formatSize(progress.downloadedSize)} downloaded
        </div>
      )}
    </div>
  );
};