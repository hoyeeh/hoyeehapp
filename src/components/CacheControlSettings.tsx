import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  HardDrive, 
  RefreshCw, 
  Trash2, 
  Wifi, 
  WifiOff, 
  CloudOff, 
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useForceRefresh } from '@/hooks/useForceRefresh';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { useCacheMonitor, formatBytes } from '@/hooks/useCacheMonitor';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function CacheControlSettings() {
  const { isRefreshing, forceRefresh, clearAndReload } = useForceRefresh();
  const { isOnline, isSyncing, pendingCount, syncPendingActions, clearPendingActions } = useBackgroundSync();
  const { stats, cleanupCache, checkAndCleanup } = useCacheMonitor();
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const bytesFreed = await cleanupCache(true);
      if (bytesFreed > 0) {
        toast.success(`Freed ${formatBytes(bytesFreed)} of storage`);
      } else {
        toast.info('Cache is already optimized');
      }
    } catch (error) {
      toast.error('Failed to cleanup cache');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleClearAll = async () => {
    setShowClearDialog(false);
    await clearAndReload();
  };

  return (
    <>
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage & Cache
          </CardTitle>
          <CardDescription>Manage app storage and offline data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-yellow-500" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {isOnline ? 'Online' : 'Offline'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isOnline 
                    ? 'All features available' 
                    : 'Some features may be limited'}
                </p>
              </div>
            </div>
            <Badge variant={isOnline ? 'default' : 'secondary'}>
              {isOnline ? 'Connected' : 'Offline'}
            </Badge>
          </div>

          {/* Pending Sync Actions */}
          {pendingCount > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-3">
                <CloudOff className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-sm">
                    {pendingCount} pending action{pendingCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Will sync when online
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={syncPendingActions}
                disabled={!isOnline || isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Sync Now'
                )}
              </Button>
            </div>
          )}

          {/* Storage Usage */}
          {stats && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Storage Used</span>
                <span className="text-sm text-muted-foreground">
                  {formatBytes(stats.storageUsage)} / {formatBytes(stats.storageQuota)}
                </span>
              </div>
              <Progress 
                value={stats.percentUsed} 
                className={stats.isOverQuota ? 'bg-red-500/20' : ''}
              />
              {stats.isOverQuota && (
                <div className="flex items-center gap-2 text-yellow-500 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  Storage is running low. Consider cleaning up.
                </div>
              )}

              {/* Cache Breakdown */}
              <div className="space-y-2 pt-2">
                <p className="text-xs text-muted-foreground">Cache breakdown:</p>
                {stats.cacheBreakdown.map((cache) => (
                  <div 
                    key={cache.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground truncate max-w-[60%]">
                      {cache.name}
                    </span>
                    <span>{formatBytes(cache.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => forceRefresh()}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Check for Updates
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleCleanup}
              disabled={isCleaningUp}
            >
              {isCleaningUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Optimize Storage
            </Button>

            <Button
              variant="destructive"
              className="w-full justify-start gap-2"
              onClick={() => setShowClearDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
              Clear All Cache
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Your downloads and login will be preserved when clearing cache
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Cache?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all cached data and reload the app. Your account and downloads will be preserved, but you may need to reload some content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>
              Clear Cache
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
