import { useState, useEffect } from "react";
import { 
  Download, 
  X, 
  Pause, 
  Play, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  CloudDownload,
  HardDrive,
  Zap,
  Settings,
  RefreshCw,
  Moon,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDownloadManager } from "@/hooks/useDownloadManager";
import { useBackgroundDownload, isBackgroundFetchSupported } from "@/hooks/useBackgroundDownload";
import { useAutoDownloadQuality } from "@/hooks/useAutoDownloadQuality";
import { useDownloadScheduler } from "@/hooks/useDownloadScheduler";
import { SchedulerSettingsDialog } from "@/components/DownloadScheduler";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

interface EnhancedDownloadQueueProps {
  isOpen: boolean;
  onClose: () => void;
}

type DownloadStatus = 'downloading' | 'paused' | 'queued' | 'completed' | 'failed' | 'expired' | 'pending';

interface UnifiedDownload {
  id: string;
  contentId: string;
  episodeId?: string;
  title: string;
  episodeTitle?: string;
  status: DownloadStatus;
  progress: number;
  speed?: number;
  eta?: number;
  downloadedSize: number;
  totalSize: number;
  isBackgroundFetch?: boolean;
  quality?: string;
  createdAt?: number;
}

function formatSpeed(bytesPerSecond: number): string {
  if (!bytesPerSecond) return '—';
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (bytesPerSecond >= 1024) {
    return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
  }
  return `${bytesPerSecond.toFixed(0)} B/s`;
}

function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function EnhancedDownloadQueue({ isOpen, onClose }: EnhancedDownloadQueueProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'scheduled' | 'completed'>('active');
  
  const {
    downloads,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteDownload,
    getProgress,
    storageUsed,
  } = useDownloadManager();

  const { pendingDownloads, isInBackground } = useBackgroundDownload();
  const { autoQuality, storageLimit, refreshStorageInfo } = useAutoDownloadQuality();
  const { 
    scheduledDownloads, 
    cancelScheduledDownload, 
    removeScheduledDownload, 
    isOffPeakNow, 
    isOnWifi,
    settings: schedulerSettings,
  } = useDownloadScheduler();
  const backgroundFetchSupported = isBackgroundFetchSupported();

  // Refresh storage info periodically
  useEffect(() => {
    if (isOpen) {
      refreshStorageInfo();
      const interval = setInterval(refreshStorageInfo, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, refreshStorageInfo]);

  // Merge downloads with real-time progress
  const allDownloads: UnifiedDownload[] = downloads.map(d => {
    const progress = getProgress(d.contentId, d.episodeId);
    const bgDownload = pendingDownloads.find(pd => pd.downloadId === d.id);
    
    return {
      id: d.id,
      contentId: d.contentId,
      episodeId: d.episodeId,
      title: d.title,
      episodeTitle: d.episodeTitle,
      status: d.status,
      progress: progress?.progress || d.progress || 0,
      speed: progress?.speed,
      eta: progress?.eta,
      downloadedSize: progress?.downloadedSize || d.downloadedSize || 0,
      totalSize: progress?.totalSize || d.totalSize || 0,
      isBackgroundFetch: bgDownload?.isBackgroundFetch,
      quality: d.quality,
      createdAt: d.createdAt,
    };
  });

  // Filter downloads by tab
  const activeDownloads = allDownloads.filter(d => 
    ['downloading', 'paused', 'queued', 'pending'].includes(d.status)
  );
  const completedDownloads = allDownloads.filter(d => d.status === 'completed');
  const failedDownloads = allDownloads.filter(d => 
    ['failed', 'expired'].includes(d.status)
  );
  
  // Filter scheduled downloads
  const pendingScheduled = scheduledDownloads.filter(d => 
    d.status === 'pending' || d.status === 'ready'
  );

  const displayedDownloads = activeTab === 'active' 
    ? activeDownloads 
    : activeTab === 'completed' 
    ? completedDownloads 
    : allDownloads;

  const getScheduleIcon = (scheduleType: string) => {
    switch (scheduleType) {
      case 'off-peak':
        return <Moon className="w-3 h-3" />;
      case 'wifi-only':
        return <Wifi className="w-3 h-3" />;
      case 'specific-time':
        return <Calendar className="w-3 h-3" />;
      default:
        return <Zap className="w-3 h-3" />;
    }
  };

  const getScheduleLabel = (download: typeof scheduledDownloads[0]) => {
    switch (download.scheduleType) {
      case 'off-peak':
        return `Off-peak (${schedulerSettings.offPeakStart} - ${schedulerSettings.offPeakEnd})`;
      case 'wifi-only':
        return 'When on Wi-Fi';
      case 'specific-time':
        return download.scheduledTime 
          ? `At ${format(new Date(download.scheduledTime), 'HH:mm')}`
          : 'Scheduled';
      default:
        return 'Immediate';
    }
  };

  const getStatusIcon = (download: UnifiedDownload) => {
    if (download.isBackgroundFetch && download.status === 'downloading') {
      return <CloudDownload className="w-4 h-4 text-primary animate-pulse" />;
    }
    
    switch (download.status) {
      case 'downloading':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-amber-500" />;
      case 'queued':
      case 'pending':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Download className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (download: UnifiedDownload) => {
    if (download.isBackgroundFetch && download.status === 'downloading') {
      return 'Background download';
    }
    
    switch (download.status) {
      case 'downloading': return 'Downloading';
      case 'paused': return 'Paused';
      case 'queued': return 'Queued';
      case 'pending': return 'Starting...';
      case 'completed': return 'Ready to watch';
      case 'failed': return 'Failed';
      case 'expired': return 'Expired';
      default: return 'Unknown';
    }
  };

  if (!isOpen) return null;

  const storagePercentage = Math.round((storageUsed / storageLimit) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-20 right-4 z-50 w-[400px] max-w-[calc(100vw-2rem)]"
    >
      <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Download className="w-5 h-5 text-primary" />
              {activeDownloads.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {activeDownloads.length}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-sm">Download Manager</h3>
              <p className="text-xs text-muted-foreground">
                {activeDownloads.length} active • {completedDownloads.length} completed
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

        {/* Status Indicators */}
        <div className="px-4 py-2 bg-muted/30 border-b border-border/30 flex items-center gap-4 text-xs">
          {backgroundFetchSupported && (
            <div className="flex items-center gap-1.5 text-primary">
              <CloudDownload className="w-3.5 h-3.5" />
              <span>Background</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="w-3.5 h-3.5" />
            <span>Auto: {autoQuality.recommendedQuality}</span>
          </div>
          <div className={cn(
            "flex items-center gap-1.5 ml-auto",
            isOffPeakNow ? "text-primary" : "text-muted-foreground"
          )}>
            <Moon className="w-3.5 h-3.5" />
            <span>{isOffPeakNow ? 'Off-peak' : 'Peak'}</span>
          </div>
          {isOnWifi ? (
            <div className="flex items-center gap-1.5 text-green-500">
              <Wifi className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-500">
              <WifiOff className="w-3.5 h-3.5" />
            </div>
          )}
          <SchedulerSettingsDialog />
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
                <TabsList className="w-full grid grid-cols-3 h-9 bg-muted/50 rounded-none">
                  <TabsTrigger value="active" className="text-xs">
                    Active
                    {activeDownloads.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                        {activeDownloads.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="scheduled" className="text-xs">
                    Scheduled
                    {pendingScheduled.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                        {pendingScheduled.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs">
                    Done
                    {completedDownloads.length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                        {completedDownloads.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Active Downloads Tab */}
                <TabsContent value="active" className="mt-0">
                  <div className="max-h-[280px] overflow-y-auto">
                    {activeDownloads.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <Download className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No active downloads</p>
                      </div>
                    ) : (
                      activeDownloads.map((download, index) => (
                        <motion.div
                          key={download.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="px-4 py-3 border-b border-border/30 last:border-0"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">{getStatusIcon(download)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {download.episodeTitle || download.title}
                              </p>
                              {['downloading', 'paused', 'pending'].includes(download.status) && (
                                <div className="mt-2 space-y-1">
                                  <Progress value={download.progress} className="h-1.5" />
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>{download.progress.toFixed(0)}%</span>
                                    {download.speed && (
                                      <span>{formatSpeed(download.speed)}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {download.status === 'downloading' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => pauseDownload(download.contentId, download.episodeId)}>
                                  <Pause className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {download.status === 'paused' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => resumeDownload(download.contentId, download.episodeId)}>
                                  <Play className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" 
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => cancelDownload(download.contentId, download.episodeId)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Scheduled Downloads Tab */}
                <TabsContent value="scheduled" className="mt-0">
                  <div className="max-h-[280px] overflow-y-auto">
                    {pendingScheduled.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No scheduled downloads</p>
                        <p className="text-xs mt-1">Use the schedule option when downloading</p>
                      </div>
                    ) : (
                      pendingScheduled.map((download, index) => (
                        <motion.div
                          key={download.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={cn(
                            "px-4 py-3 border-b border-border/30 last:border-0",
                            download.status === 'ready' && "bg-primary/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {download.status === 'ready' ? (
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              ) : (
                                <Clock className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {download.episodeTitle || download.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                {getScheduleIcon(download.scheduleType)}
                                <span>{getScheduleLabel(download)}</span>
                                <Badge variant="outline" className="px-1 py-0 text-[10px]">
                                  {download.quality}
                                </Badge>
                              </div>
                              {download.status === 'ready' && (
                                <p className="text-[10px] text-primary mt-1">Starting download...</p>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" 
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                cancelScheduledDownload(download.id);
                                removeScheduledDownload(download.id);
                              }}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Completed Downloads Tab */}
                <TabsContent value="completed" className="mt-0">
                  <div className="max-h-[280px] overflow-y-auto">
                    {completedDownloads.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No completed downloads</p>
                      </div>
                    ) : (
                      completedDownloads.map((download, index) => (
                        <motion.div
                          key={download.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="px-4 py-3 border-b border-border/30 last:border-0 bg-green-500/5"
                        >
                          <div className="flex items-start gap-3">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {download.episodeTitle || download.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatBytes(download.totalSize)} • {download.quality}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" 
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteDownload(download.contentId, download.episodeId)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Storage Footer */}
              <div className="px-4 py-3 bg-muted/20 border-t border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Storage</span>
                  </div>
                  <span className="text-xs font-medium">
                    {formatBytes(storageUsed)} / {formatBytes(storageLimit)}
                  </span>
                </div>
                <Progress 
                  value={storagePercentage} 
                  className={cn(
                    "h-1.5",
                    storagePercentage > 90 && "[&>div]:bg-destructive",
                    storagePercentage > 75 && storagePercentage <= 90 && "[&>div]:bg-amber-500"
                  )} 
                />
                {failedDownloads.length > 0 && (
                  <p className="text-[10px] text-destructive mt-2">
                    {failedDownloads.length} download(s) failed
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
