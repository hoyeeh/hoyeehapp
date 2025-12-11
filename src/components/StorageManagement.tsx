import { useState } from "react";
import { Trash2, Clock, HardDrive, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DownloadItem {
  id: string;
  title: string;
  size: number;
  status: string;
  createdAt: number;
  lastWatchedAt?: number;
  isExpired?: boolean;
}

interface StorageManagementProps {
  downloads: DownloadItem[];
  storageUsed: number;
  storageLimit: number;
  onRemoveDownloads: (ids: string[]) => Promise<void>;
  onCleanupExpired: () => Promise<number>;
  formatBytes: (bytes: number) => string;
}

export const StorageManagement = ({
  downloads,
  storageUsed,
  storageLimit,
  onRemoveDownloads,
  onCleanupExpired,
  formatBytes,
}: StorageManagementProps) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const usagePercent = Math.min((storageUsed / storageLimit) * 100, 100);
  const isNearLimit = usagePercent > 80;
  const isAtLimit = usagePercent >= 95;

  // Categorize downloads
  const expiredDownloads = downloads.filter(d => d.isExpired || d.status === 'expired');
  const oldDownloads = downloads.filter(d => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return d.createdAt < thirtyDaysAgo && d.status === 'completed';
  });
  const unwatchedDownloads = downloads.filter(d => 
    !d.lastWatchedAt && d.status === 'completed'
  );

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = (items: DownloadItem[]) => {
    const newSelected = new Set(selectedItems);
    items.forEach(item => newSelected.add(item.id));
    setSelectedItems(newSelected);
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleCleanupExpired = async () => {
    setIsCleaningUp(true);
    try {
      const count = await onCleanupExpired();
      if (count > 0) {
        toast.success(`Cleaned up ${count} expired download(s)`);
      } else {
        toast.info("No expired downloads to clean up");
      }
    } catch (error) {
      toast.error("Failed to cleanup expired downloads");
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedItems.size === 0) return;
    
    setIsCleaningUp(true);
    try {
      await onRemoveDownloads(Array.from(selectedItems));
      toast.success(`Removed ${selectedItems.size} download(s)`);
      setSelectedItems(new Set());
    } catch (error) {
      toast.error("Failed to remove downloads");
    } finally {
      setIsCleaningUp(false);
    }
  };

  const selectedSize = downloads
    .filter(d => selectedItems.has(d.id))
    .reduce((acc, d) => acc + d.size, 0);

  return (
    <Card className="bg-secondary border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-brand" />
          Storage Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Storage Usage Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Storage Used</span>
            <span className={cn(
              "font-medium",
              isAtLimit ? "text-destructive" : isNearLimit ? "text-yellow-500" : "text-foreground"
            )}>
              {formatBytes(storageUsed)} / {formatBytes(storageLimit)}
            </span>
          </div>
          <Progress 
            value={usagePercent} 
            className={cn(
              "h-3",
              isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-yellow-500" : ""
            )}
          />
          {isNearLimit && (
            <p className={cn(
              "text-xs flex items-center gap-1",
              isAtLimit ? "text-destructive" : "text-yellow-500"
            )}>
              <AlertTriangle className="h-3 w-3" />
              {isAtLimit ? "Storage limit reached!" : "Running low on storage"}
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {expiredDownloads.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanupExpired}
              disabled={isCleaningUp}
              className="justify-start"
            >
              <Clock className="h-4 w-4 mr-2 text-destructive" />
              Clean Expired ({expiredDownloads.length})
            </Button>
          )}
          
          {oldDownloads.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectAll(oldDownloads)}
              className="justify-start"
            >
              <RefreshCw className="h-4 w-4 mr-2 text-yellow-500" />
              Select Old ({oldDownloads.length})
            </Button>
          )}
          
          {unwatchedDownloads.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectAll(unwatchedDownloads)}
              className="justify-start"
            >
              <Trash2 className="h-4 w-4 mr-2 text-muted-foreground" />
              Select Unwatched ({unwatchedDownloads.length})
            </Button>
          )}
        </div>

        {/* Selectable Downloads List */}
        {downloads.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">All Downloads</h4>
              <div className="flex gap-2">
                {selectedItems.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear ({selectedItems.size})
                  </Button>
                )}
              </div>
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-1 pr-2">
              {downloads.map((download) => (
                <div
                  key={download.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer",
                    selectedItems.has(download.id) 
                      ? "bg-brand/10 border border-brand/30" 
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => toggleItem(download.id)}
                >
                  <Checkbox
                    checked={selectedItems.has(download.id)}
                    onCheckedChange={() => toggleItem(download.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{download.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(download.size)}
                      {download.isExpired && (
                        <span className="text-destructive ml-2">• Expired</span>
                      )}
                      {!download.lastWatchedAt && download.status === 'completed' && (
                        <span className="text-yellow-500 ml-2">• Never watched</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete Selected Button */}
        {selectedItems.size > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {selectedItems.size} selected • {formatBytes(selectedSize)} will be freed
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveSelected}
              disabled={isCleaningUp}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
