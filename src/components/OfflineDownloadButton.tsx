import { Download, Check, X, Loader2, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useVideoDownloader } from "@/hooks/useVideoDownloader";
import { cn } from "@/lib/utils";

interface OfflineDownloadButtonProps {
  contentId: string;
  episodeId?: string;
  title: string;
  poster: string;
  duration: number;
  /** Whether the title has a playable file at all (not the file address). */
  hasSource: boolean;
  /** Real DRM titles are never saved offline. */
  requiresDrm?: boolean;
  className?: string;
}

/**
 * Single offline download control. Shown for free, premium and paid titles
 * alike — the server decides eligibility per request (403 if not entitled).
 * Hidden only for DRM titles or titles with no file.
 */
export const OfflineDownloadButton = ({
  contentId,
  episodeId,
  title,
  poster,
  duration,
  hasSource,
  requiresDrm,
  className,
}: OfflineDownloadButtonProps) => {
  const restricted = Boolean(requiresDrm);

  const {
    isDownloading,
    progress,
    indeterminate,
    error,
    isDownloaded,
    download,
    cancelDownload,
    removeDownload,
  } = useVideoDownloader(contentId, { title, poster, duration, episodeId }, restricted);

  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current && !restricted) {
      lastErrorRef.current = error;
      toast.error(error);
    }
    if (!error) lastErrorRef.current = null;
  }, [error, restricted]);

  // HARD GATE — never render for protected content.
  if (restricted || !hasSource) return null;

  // Downloaded
  if (isDownloaded) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="secondary"
          size="lg"
          className="gap-2 min-h-[44px]"
          onClick={removeDownload}
          title="Saved offline — tap to remove"
        >
          <Check className="h-5 w-5" /> Downloaded
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={removeDownload}
          aria-label="Delete offline copy"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Downloading
  if (isDownloading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="outline"
          size="lg"
          disabled
          className="gap-2 min-h-[44px]"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {indeterminate
            ? "Downloading…"
            : progress > 0
              ? `${Math.round(progress)}%`
              : "Starting…"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={cancelDownload}
          aria-label="Cancel download"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Not downloaded
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        variant="outline"
        size="lg"
        className="gap-2 min-h-[44px]"
        onClick={download}
      >
        {error ? <RotateCw className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        {error ? "Retry" : "Download"}
      </Button>
      {error && (
        <span className="text-xs text-destructive max-w-[220px]">
          {error}
        </span>
      )}
    </div>
  );
};

export default OfflineDownloadButton;
