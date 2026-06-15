import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Trash2, Download as DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const DownloadsPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<OfflineVideoMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllDownloads();
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (contentId: string) => {
    await deleteVideo(contentId);
    setItems((prev) => prev.filter((i) => i.contentId !== contentId));
  };

  const handlePlay = (contentId: string) => {
    navigate(`/content/${encodeURIComponent(contentId)}?offline=true`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <header className="mb-8 flex items-center gap-3">
          <DownloadIcon className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-display text-2xl md:text-3xl">Offline Downloads</h1>
            <p className="text-sm text-muted-foreground">
              Watch your saved videos without an internet connection.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <DownloadIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-1">No downloads yet</h2>
            <p className="text-muted-foreground text-sm">
              Tap the download icon on a free title to save it for offline viewing.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.contentId}
                className="bg-secondary border border-border rounded-lg overflow-hidden group"
              >
                <div className="relative aspect-video bg-muted">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <Button
                      size="icon"
                      className="rounded-full"
                      onClick={() => handlePlay(item.contentId)}
                      aria-label={`Play ${item.title}`}
                    >
                      <Play className="h-5 w-5" fill="currentColor" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => handleDelete(item.contentId)}
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold truncate">{item.title}</h3>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
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
