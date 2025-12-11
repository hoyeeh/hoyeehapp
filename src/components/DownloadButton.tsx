import { Download, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Content } from "@/types";
import { useOfflineDownloads } from "@/hooks/useOfflineDownloads";
import { cn } from "@/lib/utils";

interface DownloadButtonProps {
  content: Content;
  episodeId?: string;
  episodeTitle?: string;
  variant?: "icon" | "button";
  className?: string;
}

export const DownloadButton = ({
  content,
  episodeId,
  episodeTitle,
  variant = "button",
  className,
}: DownloadButtonProps) => {
  const { downloadContent, removeDownload, isDownloaded, getProgress } = useOfflineDownloads();

  const downloadId = episodeId || content.id;
  const downloaded = isDownloaded(content.id, episodeId);
  const progress = getProgress(content.id, episodeId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloaded) {
      removeDownload(downloadId);
    } else if (!progress || progress.status === "error") {
      downloadContent(content, episodeId, episodeTitle);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
          downloaded
            ? "border-brand text-brand hover:bg-brand/10"
            : "border-muted-foreground/50 text-foreground hover:border-foreground",
          className
        )}
      >
        {progress?.status === "downloading" ? (
          <div className="relative">
            <Loader2 className="h-3 w-3 animate-spin" />
          </div>
        ) : downloaded ? (
          <Check className="h-3 w-3" />
        ) : (
          <Download className="h-3 w-3" />
        )}
      </button>
    );
  }

  return (
    <Button
      onClick={handleClick}
      variant={downloaded ? "secondary" : "outline"}
      size="sm"
      className={cn("gap-2", className)}
      disabled={progress?.status === "downloading"}
    >
      {progress?.status === "downloading" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress.progress}%
        </>
      ) : downloaded ? (
        <>
          <Trash2 className="h-4 w-4" />
          Remove Download
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download
        </>
      )}
    </Button>
  );
};
