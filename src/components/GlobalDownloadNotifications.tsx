import { useEffect, useState } from "react";
import { Download, X, Check, AlertCircle, Loader2, Pause, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DownloadProgress {
  id: string;
  title: string;
  progress: number;
  status: "pending" | "downloading" | "paused" | "completed" | "error" | "expired" | "failed";
  speed?: number;
  eta?: number;
}

interface GlobalDownloadNotificationsProps {
  activeDownloads: DownloadProgress[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
};

const formatEta = (seconds: number): string => {
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m left`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.ceil((seconds % 3600) / 60);
  return `${hours}h ${mins}m left`;
};

export const GlobalDownloadNotifications = ({
  activeDownloads,
  onPause,
  onResume,
  onCancel,
}: GlobalDownloadNotificationsProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filter out dismissed and old completed downloads
  const visibleDownloads = activeDownloads.filter(d => {
    if (dismissedIds.has(d.id)) return false;
    // Keep active downloads visible
    if (d.status === 'downloading' || d.status === 'pending' || d.status === 'paused') return true;
    // Show completed/error/failed for a while
    return d.status === 'completed' || d.status === 'error' || d.status === 'failed';
  });

  // Auto-dismiss completed downloads after 5 seconds
  useEffect(() => {
    const completedDownloads = activeDownloads.filter(
      d => (d.status === 'completed' || d.status === 'error' || d.status === 'failed') && !dismissedIds.has(d.id)
    );

    if (completedDownloads.length > 0) {
      const timer = setTimeout(() => {
        setDismissedIds(prev => {
          const newSet = new Set(prev);
          completedDownloads.forEach(d => newSet.add(d.id));
          return newSet;
        });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeDownloads, dismissedIds]);

  if (visibleDownloads.length === 0) return null;

  const activeCount = visibleDownloads.filter(
    d => d.status === 'downloading' || d.status === 'pending'
  ).length;

  const getStatusIcon = (status: DownloadProgress['status']) => {
    switch (status) {
      case 'pending':
        return <Download className="h-4 w-4 text-muted-foreground" />;
      case 'downloading':
        return <Loader2 className="h-4 w-4 text-brand animate-spin" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
      case 'expired':
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const dismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      {/* Header */}
      <div 
        className="bg-card border border-border rounded-t-lg px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-brand" />
          <span className="text-sm font-medium">
            Downloads {activeCount > 0 && `(${activeCount} active)`}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Download List */}
      {isExpanded && (
        <div className="bg-card border border-t-0 border-border rounded-b-lg max-h-80 overflow-y-auto">
          {visibleDownloads.map((download) => (
            <div
              key={download.id}
              className="p-3 border-b border-border last:border-b-0"
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  {getStatusIcon(download.status)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{download.title}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {download.status === 'downloading' && (
                      <>
                        <span>{download.progress}%</span>
                        {download.speed && download.speed > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatSpeed(download.speed)}</span>
                          </>
                        )}
                        {download.eta && download.eta > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatEta(download.eta)}</span>
                          </>
                        )}
                      </>
                    )}
                    {download.status === 'paused' && <span>Paused at {download.progress}%</span>}
                    {download.status === 'pending' && <span>Waiting...</span>}
                    {download.status === 'completed' && <span>Complete</span>}
                    {(download.status === 'error' || download.status === 'failed') && <span>Failed</span>}
                  </div>

                  {download.status === 'downloading' && (
                    <Progress value={download.progress} className="h-1 mt-2" />
                  )}
                </div>

                <div className="flex-shrink-0 flex items-center gap-1">
                  {download.status === 'downloading' && onPause && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onPause(download.id)}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  )}
                  {download.status === 'paused' && onResume && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onResume(download.id)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  {(download.status === 'completed' || download.status === 'error' || download.status === 'failed') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => dismiss(download.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  {(download.status === 'downloading' || download.status === 'pending' || download.status === 'paused') && onCancel && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => onCancel(download.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
