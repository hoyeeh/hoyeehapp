import { useUploadPersistence } from "@/hooks/useUploadPersistence";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { X, Trash2, Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";

export const UploadQueuePanel = () => {
  const { queue, removeUpload, clearCompleted, clearAll } = useUploadPersistence();

  if (queue.length === 0) {
    return null;
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <Upload className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const completedCount = queue.filter(u => u.status === 'completed').length;
  const failedCount = queue.filter(u => u.status === 'failed').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Upload Queue</CardTitle>
            <CardDescription>
              {queue.length} item{queue.length !== 1 ? 's' : ''} • 
              {completedCount > 0 && ` ${completedCount} completed`}
              {failedCount > 0 && ` • ${failedCount} failed`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {completedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCompleted}>
                Clear Completed
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-60 overflow-y-auto">
        {queue.map((upload) => (
          <div
            key={upload.id}
            className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
          >
            {getStatusIcon(upload.status)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{upload.fileName}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatBytes(upload.fileSize)}</span>
                <span>•</span>
                <span>{upload.folder}</span>
                {upload.error && (
                  <>
                    <span>•</span>
                    <span className="text-red-500">{upload.error}</span>
                  </>
                )}
              </div>
              {upload.status === 'uploading' && (
                <Progress value={upload.progress} className="h-1 mt-1" />
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => removeUpload(upload.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
