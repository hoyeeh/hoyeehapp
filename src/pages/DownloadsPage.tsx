import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Trash2, Download as DownloadIcon, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  deleteVideo,
  getAllDownloads,
  type OfflineVideoMetadata,
} from "@/services/offlineVideoStorage";
import { formatDurationCompact } from "@/utils/videoDuration";

const formatSize = (bytes: number) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const PosterImage = ({ src, alt }: { src: string; alt: string }) => {
  const [failed, setFailed] = useState(!src);
  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 via-muted to-secondary">
        <Film className="h-10 w-10 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  );
};

const DownloadsPage = () => {
  const navigate = useNavigate();
  const [downloads, setDownloads] = useState<OfflineVideoMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllDownloads();
      setDownloads(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (item: OfflineVideoMetadata) => {
    const ok = window.confirm(`Remove "${item.title}" from your downloads?`);
    if (!ok) return;
    try {
      await deleteVideo(item.contentId);
      setDownloads((prev) => prev.filter((i) => i.contentId !== item.contentId));
      toast({ title: "Download removed", description: item.title });
    } catch (e) {
      toast({
        title: "Failed to remove",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handlePlay = (item: OfflineVideoMetadata) => {
    navigate(`/watch?contentId=${encodeURIComponent(item.contentId)}&offline=true`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <header className="mb-8 flex items-center gap-3">
          <DownloadIcon className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-display text-2xl md:text-3xl">Downloads</h1>
            <p className="text-sm text-muted-foreground">
              Watch your saved videos without an internet connection.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : downloads.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <DownloadIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-1">No downloads yet</h2>
            <p className="text-muted-foreground text-sm mb-5">
              Find free content to watch offline!
            </p>
            <Button onClick={() => navigate("/free-content")}>
              Browse free content
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {downloads.map((item) => (
              <div
                key={item.contentId}
                className="bg-secondary border border-border rounded-lg overflow-hidden group flex flex-col"
              >
                <div className="relative aspect-video bg-muted">
                  <PosterImage src={item.poster} alt={item.title} />
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <Button
                      size="icon"
                      className="rounded-full"
                      onClick={() => handlePlay(item)}
                      aria-label={`Play ${item.title}`}
                    >
                      <Play className="h-5 w-5" fill="currentColor" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => handleDelete(item)}
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-semibold text-sm line-clamp-2">{item.title}</h3>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>{item.duration ? formatDurationCompact(item.duration) : ""}</span>
                    <span>{formatSize(item.size)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DownloadsPage;
