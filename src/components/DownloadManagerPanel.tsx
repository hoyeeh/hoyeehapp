import { useState } from "react";
import { useDownloadManager } from "@/hooks/useDownloadManager";
import { X, Pause, Play, Trash2, ChevronUp, ChevronDown, Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DownloadItem {
  id: string;
  contentId: string;
  episodeId?: string;
  title: string;
  episodeTitle?: string;
  progress: number;
  status: 'downloading' | 'paused' | 'completed' | 'failed' | 'queued' | 'expired' | 'pending';
  speed?: number;
  eta?: number;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
  }
  return `${bytesPerSecond.toFixed(0)} B/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function DownloadManagerPanel() {
  const { 
    downloads, 
    pauseDownload, 
    resumeDownload, 
    cancelDownload,
    getProgress,
    storageUsed,
    formatBytes,
  } = useDownloadManager();
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // Get active downloads (downloading, paused, pending, or queued)
  const activeDownloads: DownloadItem[] = downloads
    .filter(d => ['downloading', 'paused', 'pending'].includes(d.status))
    .map(d => {
      const progress = getProgress(d.contentId, d.episodeId);
      return {
        id: d.id,
        contentId: d.contentId,
        episodeId: d.episodeId,
        title: d.title,
        episodeTitle: d.episodeTitle,
        progress: progress?.progress || d.progress || 0,
        status: d.status,
        speed: progress?.speed,
        eta: progress?.eta,
      };
    });

  if (activeDownloads.length === 0) return null;

  const downloadingCount = activeDownloads.filter(d => d.status === 'downloading').length;
  const pausedCount = activeDownloads.filter(d => d.status === 'paused').length;

  if (isMinimized) {
    return (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-20 right-4 z-50"
      >
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full shadow-lg gap-2"
          size="sm"
        >
          <div className="relative">
            {downloadingCount > 0 ? (
              <Wifi className="w-4 h-4 animate-pulse" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
          </div>
          <span>
            {downloadingCount > 0 
              ? `${downloadingCount} downloading` 
              : `${pausedCount} paused`
            }
          </span>
          <ChevronUp className="w-4 h-4" />
        </Button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-20 right-4 z-50 w-80 max-h-96 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="relative">
              {downloadingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
              )}
              <Wifi className={cn(
                "w-5 h-5",
                downloadingCount > 0 ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <span className="font-medium text-sm">
              Downloads ({activeDownloads.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMinimized(true)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Downloads List */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-64 overflow-y-auto p-2 space-y-2">
                {activeDownloads.map((download) => (
                  <div
                    key={download.id}
                    className="bg-muted/30 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {download.episodeTitle || download.title}
                        </p>
                        {download.episodeTitle && (
                          <p className="text-xs text-muted-foreground truncate">
                            {download.title}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {download.status === 'downloading' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => pauseDownload(download.contentId, download.episodeId)}
                          >
                            <Pause className="w-3 h-3" />
                          </Button>
                        ) : download.status === 'paused' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => resumeDownload(download.contentId, download.episodeId)}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => cancelDownload(download.contentId, download.episodeId)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    <Progress value={download.progress} className="h-1.5" />

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{download.progress}%</span>
                      <div className="flex items-center gap-2">
                        {download.speed && download.status === 'downloading' && (
                          <span>{formatSpeed(download.speed)}</span>
                        )}
                        {download.eta && download.status === 'downloading' && (
                          <span>• {formatEta(download.eta)} left</span>
                        )}
                        {download.status === 'paused' && (
                          <span className="text-amber-500">Paused</span>
                        )}
                        {download.status === 'queued' && (
                          <span className="text-muted-foreground">Queued</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer with storage info */}
              <div className="px-3 py-2 border-t border-border/50 text-xs text-muted-foreground">
                Storage: {formatBytes(storageUsed)} / 10 GB
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
