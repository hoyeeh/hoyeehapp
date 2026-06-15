import { Download, Check, X, Loader2, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useVideoDownloader } from "@/hooks/useVideoDownloader";
import { cn } from "@/lib/utils";

interface OfflineDownloadButtonProps {
  contentId: string;
  videoUrl: string;
  title: string;
  poster: string;
  duration: number;
  isPremium?: boolean;
  requiresDrm?: boolean;
  isPaid?: boolean;
  price?: number;
  className?: string;
}

/**
 * Download button for NON-DRM, NON-premium, NON-paid content only.
 * Renders nothing for protected content.
 */
export const OfflineDownloadButton = ({
  contentId,
  videoUrl,
  title,
  poster,
  duration,
  isPremium,
  requiresDrm,
  isPaid,
  price,
  className,
}: OfflineDownloadButtonProps) => {
  // CRITICAL SAFETY GATE — strictly free, non-DRM content only.
  const gated =
    Boolean(isPremium) ||
    Boolean(requiresDrm) ||
    Boolean(isPaid) ||
    (typeof price === "number" && price > 0);

  const {
    isDownloading,
    progress,
    error,
    isDownloaded,
    download,
    cancelDownload,
    removeDownload,
  } = useVideoDownloader(
    contentId,
    videoUrl,
    { title, poster, duration },
    gated,
  );

  // Surface major failures as a toast (once per new error).
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      toast.error(`Download failed: ${error}`);
    }
    if (!error) lastErrorRef.current = null;
  }, [error]);

  if (gated || !videoUrl) return null;

  // State C: Downloaded
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

  // State B: Downloading
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
          {progress > 0 ? `${Math.round(progress)}%` : "Starting…"}
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

  // State A: Not Downloaded (with optional error retry)
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
          Download failed. Check your connection.
        </span>
      )}
    </div>
  );
};

export default OfflineDownloadButton;
