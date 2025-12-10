import { useEffect, useState } from "react";
import { Download, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DownloadNotificationProps {
  title: string;
  progress: number;
  status: "pending" | "downloading" | "completed" | "error";
  onDismiss: () => void;
}

export const DownloadNotification = ({
  title,
  progress,
  status,
  onDismiss,
}: DownloadNotificationProps) => {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-dismiss completed downloads after 5 seconds
  useEffect(() => {
    if (status === "completed" || status === "error") {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, onDismiss]);

  const getStatusIcon = () => {
    switch (status) {
      case "pending":
        return <Download className="h-5 w-5 text-muted-foreground" />;
      case "downloading":
        return <Loader2 className="h-5 w-5 text-brand animate-spin" />;
      case "completed":
        return <Check className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "pending":
        return "Waiting...";
      case "downloading":
        return `Downloading ${progress}%`;
      case "completed":
        return "Download complete";
      case "error":
        return "Download failed";
    }
  };

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-3 shadow-lg transition-all duration-300",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getStatusIcon()}</div>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{title}</p>
          <p className="text-xs text-muted-foreground">{getStatusText()}</p>
          
          {status === "downloading" && (
            <Progress value={progress} className="h-1 mt-2" />
          )}
        </div>

        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="flex-shrink-0 p-1 hover:bg-secondary rounded"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

// Download Queue Manager Component
interface DownloadQueueManagerProps {
  downloads: Array<{
    id: string;
    title: string;
    progress: number;
    status: "pending" | "downloading" | "completed" | "error";
  }>;
  onDismiss: (id: string) => void;
}

export const DownloadQueueManager = ({
  downloads,
  onDismiss,
}: DownloadQueueManagerProps) => {
  const activeDownloads = downloads.filter(
    (d) => d.status !== "completed" || Date.now() < 5000
  );

  if (activeDownloads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {activeDownloads.slice(0, 3).map((download) => (
        <DownloadNotification
          key={download.id}
          title={download.title}
          progress={download.progress}
          status={download.status}
          onDismiss={() => onDismiss(download.id)}
        />
      ))}
      
      {activeDownloads.length > 3 && (
        <div className="bg-card border border-border rounded-lg p-2 text-center text-sm text-muted-foreground">
          +{activeDownloads.length - 3} more downloads in queue
        </div>
      )}
    </div>
  );
};
