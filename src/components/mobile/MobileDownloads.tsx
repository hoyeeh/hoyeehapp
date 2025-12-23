import { useState } from "react";
import { ArrowLeft, Settings, Play, Trash2, AlertCircle, CheckCircle, HardDrive, Wifi, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MobileBottomNav } from "./MobileBottomNav";
import { SwipeNavigation } from "./SwipeNavigation";
import { MobileVideoPlayer } from "./MobileVideoPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { formatDistanceToNow } from "date-fns";
import { useHaptics } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useSmartDownload } from "@/hooks/useSmartDownload";
import { useDownloadManager } from "@/hooks/useDownloadManager";
import { Content } from "@/types";

interface DownloadItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  size: string;
  status: "completed" | "expired" | "downloading" | "paused" | "failed";
  progress?: number;
  expiresAt?: string;
  contentType: "movie" | "series";
  episodeInfo?: string;
  contentId: string;
  episodeId?: string;
  videoUrl?: string;
}

export function MobileDownloads() {
  const navigate = useNavigate();
  useAuth(); // Ensure user is authenticated
  const { currentProfile } = useProfileContext();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [wifiOnly, setWifiOnly] = useState(() => localStorage.getItem("hoyeeh-wifi-only-downloads") === "true");
  const { lightTap, selectionTap, warningFeedback, successFeedback } = useHaptics();
  const { smartDownloadEnabled, toggleSmartDownload } = useSmartDownload();
  const { 
    downloads: localDownloads, 
    getOfflineVideoUrl, 
    deleteDownload,
    storageUsed,
    storageLimit,
    formatBytes: formatStorageBytes,
    isLoading: isLocalLoading 
  } = useDownloadManager();
  
  // Video player state
  const [playingContent, setPlayingContent] = useState<{
    content: Content;
    offlineUrl: string;
    episodeId?: string;
    startTime?: number;
  } | null>(null);

  // Combine local IndexedDB downloads with Supabase license data
  const downloads: DownloadItem[] = localDownloads.map((download) => {
    const isExpired = false; // License expiry is checked when playing
    return {
      id: download.id,
      title: download.episodeTitle || download.title,
      thumbnailUrl: download.thumbnailUrl || "",
      size: formatStorageBytes(download.downloadedSize),
      status: isExpired ? "expired" : download.status === "completed" ? "completed" : 
              download.status === "paused" ? "paused" : 
              download.status === "failed" ? "failed" : "downloading",
      progress: download.progress,
      expiresAt: undefined, // We check license when playing
      contentType: "movie" as const, // Default, could be enhanced
      episodeInfo: download.episodeTitle ? `Episode` : undefined,
      contentId: download.contentId,
      episodeId: download.episodeId,
    };
  });

  const isLoading = isLocalLoading;

  // Handle playing an offline download
  const handlePlayItem = async (item: DownloadItem) => {
    if (item.status === "expired") {
      warningFeedback();
      toast.error("This download has expired. Please re-download.");
      return;
    }

    if (item.status !== "completed") {
      warningFeedback();
      toast.error("Download is not complete yet.");
      return;
    }

    lightTap();
    
    // Get offline URL from encrypted storage
    const offlineUrl = await getOfflineVideoUrl(item.contentId, item.episodeId);
    
    if (offlineUrl) {
      // Create content object for the player
      const content: Content = {
        id: item.contentId,
        title: item.title,
        description: "",
        thumbnailUrl: item.thumbnailUrl,
        videoUrl: offlineUrl, // Use offline blob URL
        genre: "",
        contentType: item.contentType as "movie" | "series",
        isPremium: false,
        duration: 0,
      };
      
      setPlayingContent({
        content,
        offlineUrl,
        episodeId: item.episodeId,
      });
    } else {
      toast.error("Unable to play offline content. It may need to be re-downloaded.");
    }
  };

  const handleClosePlayer = () => {
    // Revoke the blob URL to free memory
    if (playingContent?.offlineUrl) {
      URL.revokeObjectURL(playingContent.offlineUrl);
    }
    setPlayingContent(null);
  };

  // Calculate storage usage from actual downloads
  const storageInfo = {
    used: formatStorageBytes(storageUsed),
    total: formatStorageBytes(storageLimit),
    percentage: Math.min((storageUsed / storageLimit) * 100, 100),
  };

  const handleDelete = async (ids: string[]) => {
    warningFeedback();
    // Delete selected downloads from local storage
    for (const id of ids) {
      const item = downloads.find(d => d.id === id);
      if (item) {
        await deleteDownload(item.contentId, item.episodeId);
      }
    }
    setSelectedItems([]);
    setIsEditMode(false);
    successFeedback();
    toast.success(`${ids.length} download${ids.length > 1 ? "s" : ""} removed`);
  };

  const toggleSelect = (id: string) => {
    selectionTap();
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBack = () => {
    lightTap();
    navigate(-1);
  };

  const handleToggleEdit = () => {
    lightTap();
    setIsEditMode(!isEditMode);
    if (isEditMode) setSelectedItems([]);
  };

  const handleToggleSettings = () => {
    lightTap();
    setShowSettings(!showSettings);
  };

  const handleWifiToggle = (checked: boolean) => {
    selectionTap();
    setWifiOnly(checked);
    localStorage.setItem("hoyeeh-wifi-only-downloads", checked.toString());
    toast.success(checked ? "Downloads will only use Wi-Fi" : "Downloads can use mobile data");
  };

  // Show video player when playing content
  if (playingContent) {
    return (
      <MobileVideoPlayer
        content={playingContent.content}
        videoUrl={playingContent.offlineUrl}
        title={playingContent.content.title}
        episodeId={playingContent.episodeId}
        onClose={handleClosePlayer}
        thumbnail={playingContent.content.thumbnailUrl}
      />
    );
  }

  return (
    <SwipeNavigation enableBackGesture>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <header className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border/30 pt-safe z-50">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="p-2 -ml-2 hover:bg-secondary rounded-xl transition-colors active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold">Downloads</h1>
            </div>
            <button
              onClick={handleToggleSettings}
              className={cn(
                "p-2 hover:bg-secondary rounded-xl transition-colors active:scale-95",
                showSettings && "bg-secondary text-primary"
              )}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="px-4 py-3 space-y-3 border-b border-border/30 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Wifi className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Wi-Fi Only</p>
                  <p className="text-xs text-muted-foreground">Download only on Wi-Fi</p>
                </div>
              </div>
              <Switch checked={wifiOnly} onCheckedChange={handleWifiToggle} />
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Smart Downloads</p>
                  <p className="text-xs text-muted-foreground">Auto-download next episode</p>
                </div>
              </div>
              <Switch 
                checked={smartDownloadEnabled} 
                onCheckedChange={(checked) => {
                  selectionTap();
                  toggleSmartDownload(checked);
                  toast.success(checked ? "Smart Downloads enabled" : "Smart Downloads disabled");
                }} 
              />
            </div>
            <button
              onClick={handleToggleEdit}
              className={cn(
                "w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-colors",
                isEditMode ? "bg-primary text-primary-foreground" : "bg-secondary/50"
              )}
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-sm font-medium">{isEditMode ? "Done Editing" : "Edit Downloads"}</span>
            </button>
          </div>
        )}

        {/* Storage Info Card */}
        <div className="mx-4 mt-4 p-4 bg-secondary/50 rounded-2xl border border-border/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Storage Used</p>
              <p className="text-xs text-muted-foreground">
                {storageInfo?.used || "0 MB"} of {storageInfo?.total || "2 GB"}
              </p>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
              style={{ width: `${storageInfo?.percentage || 0}%` }}
            />
          </div>
        </div>

        {/* Profile Section */}
        <div className="px-4 mt-6 mb-4">
          <div className="flex items-center gap-2">
            {currentProfile?.avatar_url ? (
              <img 
                src={currentProfile.avatar_url} 
                alt={currentProfile.name}
                className="w-6 h-6 rounded-md object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-primary/60" />
            )}
            <span className="text-sm font-medium">{currentProfile?.name || "Downloads"}</span>
          </div>
        </div>

        {/* Downloads List */}
        <div className="px-4 space-y-3">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-28 aspect-video rounded-lg bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                </div>
              </div>
            ))
          ) : downloads.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                <HardDrive className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No Downloads Yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Download movies and shows to watch offline anytime, anywhere
              </p>
            </div>
          ) : (
            downloads.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "flex gap-3 p-2 rounded-xl transition-all cursor-pointer active:scale-[0.98]",
                  isEditMode && "bg-secondary/30",
                  selectedItems.includes(item.id) && "bg-primary/10 ring-1 ring-primary/30"
                )}
                onClick={() => {
                  if (isEditMode) {
                    toggleSelect(item.id);
                  } else {
                    handlePlayItem(item);
                  }
                }}
              >
                {/* Thumbnail */}
                <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Status overlay */}
                  {item.status === "expired" ? (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-yellow-500" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                      <div className="w-10 h-10 rounded-full bg-foreground/90 flex items-center justify-center">
                        <Play className="h-4 w-4 text-background ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  )}

                  {/* Selection checkbox */}
                  {isEditMode && (
                    <div className={cn(
                      "absolute top-1 right-1 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                      selectedItems.includes(item.id) 
                        ? "bg-primary border-primary" 
                        : "bg-background/50 border-foreground/50"
                    )}>
                      {selectedItems.includes(item.id) && (
                        <CheckCircle className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h4 className="text-sm font-medium line-clamp-1">{item.title}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.episodeInfo && (
                      <span className="text-xs text-muted-foreground">{item.episodeInfo}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{item.size}</span>
                  </div>
                  {item.status === "expired" && (
                    <span className="text-xs text-yellow-500 mt-1">Expired</span>
                  )}
                  {item.expiresAt && item.status !== "expired" && (
                    <span className="text-xs text-muted-foreground/70 mt-1">
                      Expires {formatDistanceToNow(new Date(item.expiresAt), { addSuffix: true })}
                    </span>
                  )}
                </div>

                {/* Play indicator */}
                {!isEditMode && item.status !== "expired" && (
                  <div className="p-2 self-center text-primary">
                    <Play className="h-5 w-5" fill="currentColor" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Delete Action Bar */}
        {isEditMode && selectedItems.length > 0 && (
          <div className="fixed bottom-20 left-4 right-4 p-4 bg-destructive rounded-2xl shadow-lg animate-in slide-in-from-bottom">
            <button
              onClick={() => handleDelete(selectedItems)}
              className="w-full flex items-center justify-center gap-2 py-3 text-destructive-foreground font-semibold"
            >
              <Trash2 className="h-5 w-5" />
              Delete {selectedItems.length} item{selectedItems.length > 1 ? "s" : ""}
            </button>
          </div>
        )}

        {/* Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </SwipeNavigation>
  );
}
