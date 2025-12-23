import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDownloadManager } from "@/hooks/useDownloadManager";
import { Sidebar } from "@/components/Sidebar";
import { useState, useEffect } from "react";
import { ViewState, Content } from "@/types";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useDatabase";
import { Download, Trash2, Play, HardDrive, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StorageManagement } from "@/components/StorageManagement";
import { GlobalDownloadNotifications } from "@/components/GlobalDownloadNotifications";
import { WifiOnlyToggle } from "@/components/WifiOnlyToggle";
import { DownloadExpiryWarning, isExpiringSoon } from "@/components/DownloadExpiryWarning";
import { useBackgroundDownload } from "@/hooks/useBackgroundDownload";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileDownloads } from "@/components/mobile";

const STORAGE_LIMIT = 10 * 1024 * 1024 * 1024; // 10GB

const Downloads = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { data: profile } = useProfile();
  
  // Use unified download manager for all download operations
  const {
    downloads,
    isLoading,
    storageUsed,
    deleteDownload,
    getProgress,
    getLicenseExpiry,
    getOfflineVideoUrl,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    cleanupExpiredDownloads,
    formatBytes,
  } = useDownloadManager();

  const { getPendingBackgroundDownloads } = useBackgroundDownload();

  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [playingContent, setPlayingContent] = useState<{
    content: Content;
    offlineUrl: string;
  } | null>(null);
  const [showStorageManagement, setShowStorageManagement] = useState(false);
  const [licenseExpiries, setLicenseExpiries] = useState<Record<string, number>>({});

  // Filter to only show completed downloads
  const completedDownloads = downloads.filter(d => d.status === 'completed');

  // Load license expiries for all downloads
  useEffect(() => {
    const loadExpiries = async () => {
      const expiries: Record<string, number> = {};
      for (const d of completedDownloads) {
        const expiry = await getLicenseExpiry(d.contentId, d.episodeId);
        if (expiry) {
          expiries[d.id] = expiry;
        }
      }
      setLicenseExpiries(expiries);
    };
    
    if (completedDownloads.length > 0) {
      loadExpiries();
    }
  }, [completedDownloads, getLicenseExpiry]);

  // Check for expiring downloads
  useEffect(() => {
    const expiringCount = Object.values(licenseExpiries).filter(expiry => isExpiringSoon(expiry)).length;
    if (expiringCount > 0) {
      toast.warning(`${expiringCount} download${expiringCount > 1 ? 's' : ''} expiring soon`);
    }
  }, [licenseExpiries]);

  // Check for pending background downloads
  useEffect(() => {
    const pending = getPendingBackgroundDownloads();
    if (pending.length > 0) {
      toast.info(`${pending.length} download${pending.length > 1 ? 's' : ''} ready to resume`);
    }
  }, [getPendingBackgroundDownloads]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const handlePlay = async (downloadId: string, contentId: string, episodeId?: string) => {
    const offlineUrl = await getOfflineVideoUrl(contentId, episodeId);
    if (offlineUrl) {
      const download = downloads.find(d => d.id === downloadId);
      if (download) {
        setPlayingContent({
          content: {
            id: download.contentId,
            title: download.title,
            description: '',
            thumbnailUrl: download.thumbnailUrl || '',
            videoUrl: '',
            contentType: 'movie',
            genre: '',
            year: 0,
            rating: '',
            duration: download.duration,
            isPremium: false,
            contentRating: download.contentRating || 'PG',
          },
          offlineUrl,
        });
      }
    } else {
      toast.error("Failed to load offline video");
    }
  };

  const handleDeleteDownload = async (contentId: string, episodeId?: string) => {
    await deleteDownload(contentId, episodeId);
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (playingContent) {
    return (
      <VideoPlayer
        src={playingContent.offlineUrl}
        title={playingContent.content.title}
        contentId={playingContent.content.id}
        onBack={() => {
          // Revoke blob URL to free memory
          URL.revokeObjectURL(playingContent.offlineUrl);
          setPlayingContent(null);
        }}
      />
    );
  }

  // Mobile PWA Downloads View
  if (isMobile) {
    return <MobileDownloads />;
  }

  // Active downloads for notification panel
  const activeDownloads = downloads.filter(d => 
    d.status === 'downloading' || d.status === 'paused' || d.status === 'pending'
  );

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        currentView={"home"}
        onNavigate={(view) => {
          navigate(view === "home" ? "/" : `/${view}`);
        }}
        onLogout={handleLogout}
        userName={profile?.display_name || user.email?.split("@")[0]}
      />

      <main className="ml-16 md:ml-64 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-4xl flex items-center gap-3">
                <Download className="h-8 w-8 text-brand" />
                Downloads
              </h1>
              <p className="text-muted-foreground mt-2">
                Watch your favorite content offline within the app
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Storage Management Toggle */}
              <Button
                variant={showStorageManagement ? "default" : "outline"}
                size="sm"
                onClick={() => setShowStorageManagement(!showStorageManagement)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Manage Storage
              </Button>

              {/* Storage Info */}
              <Card className="bg-secondary border-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <HardDrive className="h-5 w-5 text-brand" />
                  <div>
                    <p className="text-sm font-medium">Storage Used</p>
                    <p className="text-lg font-bold text-brand">
                      {formatBytes(storageUsed)} / {formatBytes(STORAGE_LIMIT)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Storage Management Panel */}
          {showStorageManagement && (
            <div className="mb-8 space-y-4">
              {/* Wi-Fi Only Toggle */}
              <WifiOnlyToggle />
              
              <StorageManagement
                downloads={completedDownloads.map(d => ({
                  id: d.id,
                  title: d.episodeTitle || d.title,
                  size: d.downloadedSize,
                  status: 'completed',
                  createdAt: d.createdAt,
                  lastWatchedAt: d.lastWatchedPosition ? d.updatedAt : undefined,
                  isExpired: licenseExpiries[d.id] ? licenseExpiries[d.id] < Date.now() : false,
                }))}
                storageUsed={storageUsed}
                storageLimit={STORAGE_LIMIT}
                onRemoveDownloads={async (ids) => {
                  for (const id of ids) {
                    const download = downloads.find(d => d.id === id);
                    if (download) {
                      await deleteDownload(download.contentId, download.episodeId);
                    }
                  }
                }}
                onCleanupExpired={cleanupExpiredDownloads}
                formatBytes={formatBytes}
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-brand" />
            </div>
          ) : completedDownloads.length === 0 ? (
            <div className="text-center py-16">
              <Download className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No downloads yet</h2>
              <p className="text-muted-foreground mb-6">
                Download movies and shows to watch them offline
              </p>
              <Button onClick={() => navigate("/")} variant="default">
                Browse Content
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedDownloads.map((download) => (
                <Card
                  key={download.id}
                  className="bg-secondary border-border overflow-hidden group hover:border-brand/50 transition-colors"
                >
                  <div className="relative aspect-video">
                    <img
                      src={download.thumbnailUrl || '/placeholder.svg'}
                      alt={download.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <Button
                        size="icon"
                        className="rounded-full bg-brand hover:bg-brand/90"
                        onClick={() => handlePlay(download.id, download.contentId, download.episodeId)}
                      >
                        <Play className="h-5 w-5" fill="currentColor" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => handleDeleteDownload(download.contentId, download.episodeId)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold truncate">
                      {download.episodeTitle || download.title}
                    </h3>
                    {download.episodeTitle && (
                      <p className="text-sm text-muted-foreground truncate">
                        {download.title}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{formatBytes(download.downloadedSize)}</span>
                      {licenseExpiries[download.id] ? (
                        <DownloadExpiryWarning expiresAt={licenseExpiries[download.id]} variant="badge" />
                      ) : (
                        <span>
                          {new Date(download.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedContent && (
        <ContentDetailsModal
          content={selectedContent}
          onClose={() => setSelectedContent(null)}
          onPlay={(c) => handlePlay(c.id, c.id)}
          onToggleList={() => {}}
          isInList={false}
        />
      )}

      {/* Global Download Notifications */}
      <GlobalDownloadNotifications
        activeDownloads={activeDownloads.map(d => {
          const progress = getProgress(d.contentId, d.episodeId);
          return {
            id: d.id,
            title: d.episodeTitle || d.title,
            progress: progress?.progress || 0,
            status: d.status,
            speed: progress?.speed,
            eta: progress?.eta,
          };
        })}
        onPause={(id) => {
          const download = downloads.find(d => d.id === id);
          if (download) pauseDownload(download.contentId, download.episodeId);
        }}
        onResume={(id) => {
          const download = downloads.find(d => d.id === id);
          if (download) resumeDownload(download.contentId, download.episodeId);
        }}
        onCancel={(id) => {
          const download = downloads.find(d => d.id === id);
          if (download) cancelDownload(download.contentId, download.episodeId);
        }}
      />
    </div>
  );
};

export default Downloads;
