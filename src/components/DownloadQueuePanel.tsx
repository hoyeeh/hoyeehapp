import { useState, useEffect } from "react";
import { 
  Download, 
  X, 
  Pause, 
  Play, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Zap,
  Wifi,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSmartDownload } from "@/hooks/useSmartDownload";
import { useDownloadManager } from "@/hooks/useDownloadManager";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

interface DownloadQueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: "floating" | "inline";
}

export function DownloadQueuePanel({ 
  isOpen, 
  onClose, 
  variant = "floating" 
}: DownloadQueuePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { 
    smartDownloadEnabled, 
    downloadQueue, 
    isProcessing,
    toggleSmartDownload 
  } = useSmartDownload();
  
  const downloadManager = useDownloadManager();

  // Define unified download item type
  interface UnifiedDownloadItem {
    id: string;
    title: string;
    status: 'downloading' | 'paused' | 'queued' | 'completed' | 'failed';
    progress: number;
    size?: number;
    downloadedSize?: number;
    type: 'active' | 'smart';
    showTitle?: string;
  }

  // Combine smart download queue with active downloads
  const allDownloads: UnifiedDownloadItem[] = [
    ...downloadQueue.map(item => ({
      id: item.episodeId,
      title: item.title,
      status: item.status,
      progress: item.progress || 0,
      type: 'smart' as const,
      showTitle: item.showTitle,
    }))
  ];

  const activeCount = allDownloads.filter(d => 
    d.status === 'downloading' || d.status === 'queued'
  ).length;

  const completedCount = allDownloads.filter(d => d.status === 'completed').length;

  if (!isOpen || allDownloads.length === 0) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'downloading':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-amber-500" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Download className="w-4 h-4" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const panelContent = (
    <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Download className="w-5 h-5 text-primary" />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">Download Queue</h3>
            <p className="text-xs text-muted-foreground">
              {activeCount} active • {completedCount} completed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
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
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Smart Download Status */}
      {smartDownloadEnabled && (
        <div className="px-4 py-2 bg-primary/5 border-b border-border/30 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary">Smart Downloads Active</span>
          {isProcessing && (
            <Loader2 className="w-3 h-3 animate-spin text-primary ml-auto" />
          )}
        </div>
      )}

      {/* Download List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-[300px] overflow-y-auto">
              {allDownloads.map((download, index) => (
                <motion.div
                  key={download.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "px-4 py-3 border-b border-border/30 last:border-0",
                    download.status === 'completed' && "bg-green-500/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div className="mt-1">
                      {getStatusIcon(download.status)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{download.title}</p>
                        {download.type === 'smart' && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded">
                            Smart
                          </span>
                        )}
                      </div>
                      {download.showTitle && (
                        <p className="text-xs text-muted-foreground truncate">{download.showTitle}</p>
                      )}

                      {/* Progress Bar */}
                      {(download.status === 'downloading' || download.status === 'paused') && (
                        <div className="mt-2 space-y-1">
                          <Progress value={download.progress} className="h-1.5" />
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{download.progress?.toFixed(0) || 0}%</span>
                            {download.downloadedSize !== undefined && download.size !== undefined && (
                              <span>
                                {formatBytes(download.downloadedSize)} / {formatBytes(download.size)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Status Text */}
                      <p className="text-[10px] text-muted-foreground mt-1 capitalize">
                        {download.status === 'queued' && 'Waiting in queue...'}
                        {download.status === 'downloading' && 'Downloading...'}
                        {download.status === 'paused' && 'Paused'}
                        {download.status === 'completed' && 'Ready to watch'}
                        {download.status === 'failed' && 'Download failed'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {download.status === 'downloading' && download.type === 'active' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => downloadManager.pauseDownload(download.id)}
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {download.status === 'paused' && download.type === 'active' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => downloadManager.resumeDownload(download.id)}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {download.type === 'active' && download.status !== 'completed' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => downloadManager.cancelDownload(download.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-muted/20 border-t border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Downloads use {localStorage.getItem("wifi-only-download") === "true" ? "Wi-Fi only" : "any network"}</span>
                </div>
                {smartDownloadEnabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => toggleSmartDownload(false)}
                  >
                    Disable Smart
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (variant === "inline") {
    return panelContent;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-20 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)]"
    >
      {panelContent}
    </motion.div>
  );
}