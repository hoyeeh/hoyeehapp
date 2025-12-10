import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Cog, CheckCircle, XCircle, Play } from "lucide-react";
import { useTranscodingStatus, useQueueTranscoding } from "@/hooks/useTranscoding";
import { useToast } from "@/hooks/use-toast";

interface TranscodingStatusProps {
  episodeId: string;
  videoUrl: string | null;
  onTranscoded?: (hlsUrl: string) => void;
}

export const TranscodingStatus = ({ episodeId, videoUrl, onTranscoded }: TranscodingStatusProps) => {
  const { toast } = useToast();
  const { data: job, isLoading } = useTranscodingStatus(episodeId);
  const queueTranscoding = useQueueTranscoding();

  const handleStartTranscode = async () => {
    if (!videoUrl) {
      toast({ title: "No video to transcode", variant: "destructive" });
      return;
    }

    try {
      await queueTranscoding.mutateAsync({
        episodeId,
        sourceUrl: videoUrl,
        format: 'hls',
      });
      toast({ 
        title: "Transcoding Queued",
        description: "Note: Full transcoding requires an external service (AWS MediaConvert, Mux, etc.)"
      });
    } catch (error) {
      toast({ title: "Failed to queue transcoding", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (!job) {
    // No transcoding job exists
    if (!videoUrl) {
      return <span className="text-xs text-muted-foreground">No video</span>;
    }

    return (
      <Button 
        size="sm" 
        variant="outline" 
        onClick={handleStartTranscode}
        disabled={queueTranscoding.isPending}
        className="gap-1 text-xs h-7"
      >
        {queueTranscoding.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Cog className="h-3 w-3" />
        )}
        Transcode to HLS
      </Button>
    );
  }

  // Show job status
  switch (job.status) {
    case 'pending':
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Queued
        </Badge>
      );
    
    case 'processing':
      return (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {job.progress}%
          </Badge>
          <Progress value={job.progress} className="w-16 h-1" />
        </div>
      );
    
    case 'completed':
      return (
        <Badge variant="default" className="gap-1 bg-green-600">
          <CheckCircle className="h-3 w-3" />
          HLS Ready
        </Badge>
      );
    
    case 'failed':
      return (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleStartTranscode}
            className="h-6 text-xs"
          >
            Retry
          </Button>
        </div>
      );
    
    default:
      return null;
  }
};
