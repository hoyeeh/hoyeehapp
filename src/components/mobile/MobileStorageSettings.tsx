import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, HardDrive, Trash2, Download, AlertTriangle, Sparkles, Film, Smartphone } from "lucide-react";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { 
  listDownloads, 
  clearAllDownloads, 
  getStorageUsed, 
  formatBytes,
  DownloadMetadata 
} from "@/lib/downloadStorage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MobileStorageSettingsProps {
  onClose: () => void;
}

interface QualityBreakdown {
  quality: string;
  label: string;
  count: number;
  size: number;
  color: string;
  icon: React.ReactNode;
}

export function MobileStorageSettings({ onClose }: MobileStorageSettingsProps) {
  const { lightTap, successFeedback, mediumTap } = useHaptics();
  const [downloads, setDownloads] = useState<DownloadMetadata[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // Assume a reasonable storage limit (e.g., 10GB for mobile)
  const storageLimit = 10 * 1024 * 1024 * 1024; // 10GB
  const storagePercentage = Math.min((storageUsed / storageLimit) * 100, 100);

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    try {
      const [downloadsList, used] = await Promise.all([
        listDownloads(),
        getStorageUsed()
      ]);
      setDownloads(downloadsList);
      setStorageUsed(used);
    } catch (error) {
      console.error("Failed to load storage data:", error);
    }
  };

  // Calculate storage breakdown by quality
  const qualityBreakdown = useMemo((): QualityBreakdown[] => {
    const breakdown: Record<string, { count: number; size: number }> = {
      high: { count: 0, size: 0 },
      medium: { count: 0, size: 0 },
      low: { count: 0, size: 0 },
    };

    downloads.forEach(download => {
      const quality = download.quality?.toLowerCase() || 'medium';
      const normalizedQuality = quality.includes('1080') || quality === 'high' 
        ? 'high' 
        : quality.includes('720') || quality === 'medium' 
          ? 'medium' 
          : 'low';
      
      if (breakdown[normalizedQuality]) {
        breakdown[normalizedQuality].count++;
        breakdown[normalizedQuality].size += download.downloadedSize || 0;
      }
    });

    return [
      {
        quality: 'high',
        label: 'High Quality (1080p)',
        count: breakdown.high.count,
        size: breakdown.high.size,
        color: 'bg-purple-500',
        icon: <Sparkles className="w-4 h-4 text-purple-500" />,
      },
      {
        quality: 'medium',
        label: 'Standard (720p)',
        count: breakdown.medium.count,
        size: breakdown.medium.size,
        color: 'bg-blue-500',
        icon: <Film className="w-4 h-4 text-blue-500" />,
      },
      {
        quality: 'low',
        label: 'Data Saver (480p)',
        count: breakdown.low.count,
        size: breakdown.low.size,
        color: 'bg-green-500',
        icon: <Smartphone className="w-4 h-4 text-green-500" />,
      },
    ];
  }, [downloads]);

  const totalQualitySize = qualityBreakdown.reduce((acc, q) => acc + q.size, 0);

  const handleBack = () => {
    lightTap();
    onClose();
  };

  const handleClearCache = async () => {
    setIsClearing(true);
    mediumTap();
    
    try {
      await clearAllDownloads();
      successFeedback();
      toast.success("All downloads cleared");
      setDownloads([]);
      setStorageUsed(0);
      setShowClearDialog(false);
    } catch (error) {
      toast.error("Failed to clear downloads");
    } finally {
      setIsClearing(false);
    }
  };

  const completedDownloads = downloads.filter(d => d.status === 'completed');
  const pendingDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'pending' || d.status === 'paused');

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-background"
    >
      <header className="fixed top-0 left-0 right-0 z-50 pt-safe bg-background/80 backdrop-blur-xl border-b border-border/10">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Storage</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="pb-8 px-4 overflow-y-auto h-screen" style={{ paddingTop: 'calc(80px + env(safe-area-inset-top, 20px))' }}>
        {/* Storage Overview Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-3xl p-6 mb-6 border border-border/10"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
              <HardDrive className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Downloaded Content</p>
              <p className="text-2xl font-bold">{formatBytes(storageUsed)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Storage Used</span>
              <span className="font-medium">{storagePercentage.toFixed(1)}%</span>
            </div>
            <Progress 
              value={storagePercentage} 
              className={cn(
                "h-3 rounded-full",
                storagePercentage > 80 && "bg-destructive/20"
              )}
            />
            <p className="text-xs text-muted-foreground text-right">
              of {formatBytes(storageLimit)} limit
            </p>
          </div>

          {storagePercentage > 80 && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-amber-500/10 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-amber-500">Storage almost full. Consider removing some downloads.</p>
            </div>
          )}
        </motion.div>

        {/* Storage by Quality Section */}
        {downloads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Storage by Quality
            </h3>
            
            {/* Quality Breakdown Bar */}
            <div className="bg-muted/20 rounded-2xl p-4 mb-3">
              <div className="h-4 rounded-full overflow-hidden flex bg-muted/30">
                {qualityBreakdown.map((item, index) => (
                  item.size > 0 && (
                    <motion.div
                      key={item.quality}
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.size / Math.max(totalQualitySize, 1)) * 100}%` }}
                      transition={{ delay: 0.1 + index * 0.1, duration: 0.5 }}
                      className={cn("h-full", item.color)}
                    />
                  )
                ))}
              </div>
            </div>

            {/* Quality Breakdown List */}
            <div className="space-y-2">
              {qualityBreakdown.map((item, index) => (
                <motion.div
                  key={item.quality}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + index * 0.05 }}
                  className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    item.quality === 'high' && "bg-purple-500/20",
                    item.quality === 'medium' && "bg-blue-500/20",
                    item.quality === 'low' && "bg-green-500/20"
                  )}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} {item.count === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{formatBytes(item.size)}</p>
                    <p className="text-xs text-muted-foreground">
                      {totalQualitySize > 0 ? ((item.size / totalQualitySize) * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Download Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          <div className="bg-muted/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Completed</span>
            </div>
            <p className="text-2xl font-bold">{completedDownloads.length}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(completedDownloads.reduce((acc, d) => acc + d.downloadedSize, 0))}
            </p>
          </div>
          <div className="bg-muted/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-blue-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">In Progress</span>
            </div>
            <p className="text-2xl font-bold">{pendingDownloads.length}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(pendingDownloads.reduce((acc, d) => acc + d.downloadedSize, 0))}
            </p>
          </div>
        </motion.div>

        {/* Downloaded Content List */}
        {completedDownloads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              Downloaded Content
            </h3>
            <div className="space-y-2">
              {completedDownloads.slice(0, 5).map((download, index) => (
                <div
                  key={download.id}
                  className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl"
                >
                  <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
                    {download.thumbnailUrl ? (
                      <img src={download.thumbnailUrl} alt={download.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Download className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{download.title}</p>
                    {download.episodeTitle && (
                      <p className="text-xs text-muted-foreground truncate">{download.episodeTitle}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatBytes(download.downloadedSize)} • {download.quality}</p>
                  </div>
                </div>
              ))}
              {completedDownloads.length > 5 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  +{completedDownloads.length - 5} more downloads
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Clear All Button */}
        {downloads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={() => {
                lightTap();
                setShowClearDialog(true);
              }}
              variant="ghost"
              className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Downloads
            </Button>
          </motion.div>
        )}

        {downloads.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Download className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No downloaded content</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Download movies and shows to watch offline
            </p>
          </motion.div>
        )}
      </main>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Downloads?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {downloads.length} downloaded items ({formatBytes(storageUsed)}). You'll need to re-download them to watch offline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearCache}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground"
            >
              {isClearing ? "Clearing..." : "Clear All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
