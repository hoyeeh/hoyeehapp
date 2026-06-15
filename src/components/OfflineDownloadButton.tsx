import { Download, Check, X, Loader2 } from "lucide-react";
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
  className,
}: OfflineDownloadButtonProps) => {
  const gated = isPremium || requiresDrm || isPaid;

  const {
    isDownloading,
    progress,
    error,
    isDownloaded,
    download,
    cancelDownload,
    removeDownload,
  } = useVideoDownloader({
    contentId,
    videoUrl,
    metadata: { title, poster, duration },
    isPremium,
    requiresDrm,
    isPaid,
  });

  if (gated || !videoUrl) return null;

  if (isDownloaded) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={cn("gap-2", className)}
        onClick={removeDownload}
        title="Remove offline copy"
      >
        <Check className="h-4 w-4" /> Downloaded
      </Button>
    );
  }

  if (isDownloading) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-2", className)}
        onClick={cancelDownload}
        title="Cancel download"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {progress > 0 ? `${progress}%` : "Starting…"}
        <X className="h-3 w-3 ml-1" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("gap-2", className)}
      onClick={download}
      title={error || "Download for offline viewing"}
    >
      <Download className="h-4 w-4" /> Download
    </Button>
  );
};

export default OfflineDownloadButton;
