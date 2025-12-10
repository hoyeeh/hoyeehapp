import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineDownloads } from "@/hooks/useOfflineDownloads";
import { Sidebar } from "@/components/Sidebar";
import { useState } from "react";
import { ViewState, Content } from "@/types";
import { ContentDetailsModal } from "@/components/ContentDetailsModal";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useDatabase";
import { Download, Trash2, Play, HardDrive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const Downloads = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const {
    downloads,
    isLoading,
    removeDownload,
    getOfflineVideoUrl,
    getTotalStorageUsed,
    formatBytes,
  } = useOfflineDownloads();

  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [playingContent, setPlayingContent] = useState<{
    content: Content;
    offlineUrl: string;
  } | null>(null);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const handlePlay = async (content: Content, downloadId: string) => {
    const offlineUrl = await getOfflineVideoUrl(downloadId);
    if (offlineUrl) {
      setPlayingContent({ content, offlineUrl });
    } else {
      toast.error("Failed to load offline video");
    }
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl md:text-4xl flex items-center gap-3">
                <Download className="h-8 w-8 text-brand" />
                Downloads
              </h1>
              <p className="text-muted-foreground mt-2">
                Watch your favorite content offline within the app
              </p>
            </div>

            {/* Storage Info */}
            <Card className="bg-secondary border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-brand" />
                <div>
                  <p className="text-sm font-medium">Storage Used</p>
                  <p className="text-lg font-bold text-brand">
                    {formatBytes(getTotalStorageUsed())}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-brand" />
            </div>
          ) : downloads.length === 0 ? (
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
              {downloads.map((download) => (
                <Card
                  key={download.id}
                  className="bg-secondary border-border overflow-hidden group hover:border-brand/50 transition-colors"
                >
                  <div className="relative aspect-video">
                    <img
                      src={download.content.thumbnailUrl}
                      alt={download.content.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <Button
                        size="icon"
                        className="rounded-full bg-brand hover:bg-brand/90"
                        onClick={() => handlePlay(download.content, download.id)}
                      >
                        <Play className="h-5 w-5" fill="currentColor" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => removeDownload(download.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold truncate">
                      {download.episodeTitle || download.content.title}
                    </h3>
                    {download.episodeTitle && (
                      <p className="text-sm text-muted-foreground truncate">
                        {download.content.title}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{formatBytes(download.totalSize)}</span>
                      <span>
                        {new Date(download.downloadedAt).toLocaleDateString()}
                      </span>
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
          onPlay={(c) => handlePlay(c, c.id)}
          onToggleList={() => {}}
          isInList={false}
        />
      )}
    </div>
  );
};

export default Downloads;
