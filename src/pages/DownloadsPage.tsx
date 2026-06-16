import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteDownload as deleteNewDownload } from "@/services/offlineStorage";
import {
  listUnifiedDownloads,
  type UnifiedDownload,
} from "@/services/unifiedOfflineVideo";
import { deleteDownload as deleteLegacyDownload, getDownloadId } from "@/lib/downloadStorage";

const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
};

const DownloadsPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<UnifiedDownload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listUnifiedDownloads()
      .then((rows) => {
        // eslint-disable-next-line no-console
        console.log("Downloads from DB (unified):", rows);
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);


  const handleDelete = async (item: UnifiedDownload) => {
    try {
      if (item.source === "legacy") {
        await deleteLegacyDownload(getDownloadId(item.contentId, item.episodeId));
      } else {
        await deleteNewDownload(item.contentId);
      }
      setItems((prev) =>
        prev.filter(
          (it) =>
            !(it.contentId === item.contentId && it.episodeId === item.episodeId && it.source === item.source),
        ),
      );
      toast.success("Removed from downloads");
    } catch {
      toast.error("Failed to delete download");
    }
  };


  const handlePlay = (contentId: string) => {
    navigate(`/watch?contentId=${contentId}&offline=true`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Downloads</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Download className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No downloads yet</h2>
            <p className="text-muted-foreground max-w-sm mb-6">
              Save free titles to watch them anywhere — even without an internet
              connection.
            </p>
            <Button asChild>
              <Link to="/free-content">Browse free content</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {items.map((item) => (
              <div
                key={`${item.source}:${item.contentId}:${item.episodeId ?? ""}`}
                className="group rounded-lg overflow-hidden bg-card border border-border flex flex-col"
              >
                <button
                  onClick={() => handlePlay(item.contentId)}
                  className="relative aspect-[2/3] bg-muted overflow-hidden"
                  aria-label={`Play ${item.title}`}
                >
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Play className="h-10 w-10" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="h-6 w-6 text-black fill-black" />
                    </div>
                  </div>
                </button>

                <div className="p-2 flex flex-col gap-2 flex-1">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[formatDuration(item.duration), formatSize(item.size)]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5 min-h-[36px]"
                      onClick={() => handlePlay(item.contentId)}
                    >
                      <Play className="h-3.5 w-3.5" /> Play
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="min-h-[36px] min-w-[36px]"
                      onClick={() => handleDelete(item.contentId)}
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DownloadsPage;
