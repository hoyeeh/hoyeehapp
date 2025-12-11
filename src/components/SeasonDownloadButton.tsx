import { Download, ChevronDown, Pause, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Content } from "@/types";
import { useDownloadManager } from "@/hooks/useDownloadManager";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

interface Episode {
  id: string;
  title: string;
  episode_number: number;
  video_url?: string | null;
}

interface SeasonDownloadButtonProps {
  content: Content;
  seasonId: string;
  seasonNumber: number;
  episodes: Episode[];
  className?: string;
}

const QUALITY_OPTIONS = [
  { value: "480p", label: "480p", size: "~500MB/ep" },
  { value: "720p", label: "720p (HD)", size: "~1GB/ep" },
  { value: "1080p", label: "1080p (Full HD)", size: "~2GB/ep" },
] as const;

type QualityOption = typeof QUALITY_OPTIONS[number]["value"];

export const SeasonDownloadButton = ({
  content,
  seasonId,
  seasonNumber,
  episodes,
  className,
}: SeasonDownloadButtonProps) => {
  const { startDownload, cancelDownload, isDownloaded, getProgress, downloads } = useDownloadManager();
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);

  // Filter episodes with video URLs
  const downloadableEpisodes = useMemo(() => 
    episodes.filter(ep => ep.video_url), 
    [episodes]
  );

  // Calculate season download status
  const seasonStatus = useMemo(() => {
    let downloaded = 0;
    let downloading = 0;
    let totalProgress = 0;
    let totalSpeed = 0;
    let activeDownloads = 0;

    downloadableEpisodes.forEach(ep => {
      if (isDownloaded(content.id, ep.id)) {
        downloaded++;
      }
      const progress = getProgress(content.id, ep.id);
      if (progress?.status === "downloading") {
        downloading++;
        totalProgress += progress.progress;
        if (progress.speed) {
          totalSpeed += progress.speed;
          activeDownloads++;
        }
      }
    });

    const allDownloaded = downloaded === downloadableEpisodes.length;
    const anyDownloading = downloading > 0;
    const avgProgress = downloading > 0 ? Math.round(totalProgress / downloading) : 0;
    const avgSpeed = activeDownloads > 0 ? totalSpeed / activeDownloads : 0;

    return {
      downloaded,
      downloading,
      total: downloadableEpisodes.length,
      allDownloaded,
      anyDownloading,
      avgProgress,
      avgSpeed,
    };
  }, [downloadableEpisodes, content.id, isDownloaded, getProgress, downloads]);

  const handleBatchDownload = async (quality: QualityOption) => {
    setShowQualityMenu(false);
    setIsBatchDownloading(true);

    // Download episodes sequentially to avoid overwhelming the server
    for (const episode of downloadableEpisodes) {
      if (!isDownloaded(content.id, episode.id)) {
        const progress = getProgress(content.id, episode.id);
        if (!progress || progress.status === "failed") {
          await startDownload(
            content,
            episode.id,
            `S${seasonNumber}E${episode.episode_number} - ${episode.title}`,
            quality
          );
          // Small delay between starting downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    setIsBatchDownloading(false);
  };

  const handleCancelAll = () => {
    downloadableEpisodes.forEach(ep => {
      const progress = getProgress(content.id, ep.id);
      if (progress?.status === "downloading") {
        cancelDownload(content.id, ep.id);
      }
    });
    setIsBatchDownloading(false);
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  if (downloadableEpisodes.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <DropdownMenu open={showQualityMenu} onOpenChange={setShowQualityMenu}>
        <DropdownMenuTrigger asChild>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              if (seasonStatus.anyDownloading) {
                handleCancelAll();
              } else if (!seasonStatus.allDownloaded) {
                setShowQualityMenu(true);
              }
            }}
            variant={seasonStatus.allDownloaded ? "secondary" : "outline"}
            size="sm"
            className="gap-2 w-full"
            disabled={isBatchDownloading && !seasonStatus.anyDownloading}
          >
            {seasonStatus.anyDownloading ? (
              <>
                <X className="h-4 w-4" />
                Cancel All ({seasonStatus.downloading} downloading)
              </>
            ) : seasonStatus.allDownloaded ? (
              <>
                <Check className="h-4 w-4" />
                Season {seasonNumber} Downloaded
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download Season {seasonNumber}
                <span className="text-xs text-muted-foreground ml-1">
                  ({seasonStatus.downloaded}/{seasonStatus.total})
                </span>
                <ChevronDown className="h-3 w-3 ml-auto" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 bg-popover border-border">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Download All {downloadableEpisodes.length} Episodes
          </div>
          {QUALITY_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleBatchDownload(option.value)}
              className="flex justify-between cursor-pointer"
            >
              <span>{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.size}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Batch progress */}
      {seasonStatus.anyDownloading && (
        <div className="space-y-1 px-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Downloading {seasonStatus.downloading} of {seasonStatus.total - seasonStatus.downloaded} remaining</span>
            {seasonStatus.avgSpeed > 0 && (
              <span className="text-brand font-medium">{formatSpeed(seasonStatus.avgSpeed)}</span>
            )}
          </div>
          <Progress value={(seasonStatus.downloaded / seasonStatus.total) * 100} className="h-1.5" />
          <div className="text-xs text-muted-foreground">
            {seasonStatus.downloaded} completed • {seasonStatus.downloading} in progress
          </div>
        </div>
      )}
    </div>
  );
};
