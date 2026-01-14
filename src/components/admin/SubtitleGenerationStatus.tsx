import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { RefreshCw, Play, CheckCircle, XCircle, Clock, Loader2, AlertCircle, Languages } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SubtitleLog {
  id: string;
  content_id: string;
  episode_id: string | null;
  status: string;
  video_url: string | null;
  video_duration_seconds: number | null;
  transcription_model: string;
  languages_generated: string[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "transcribing":
    case "translating":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: "default",
    failed: "destructive",
    pending: "secondary",
    transcribing: "outline",
    translating: "outline",
  };

  return (
    <Badge variant={variants[status] || "secondary"} className="capitalize">
      {status}
    </Badge>
  );
};

export const SubtitleGenerationStatus = () => {
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["subtitle-generation-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subtitle_generation_logs")
        .select(`
          *,
          content:content_id(title),
          episode:episode_id(title)
        `)
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as (SubtitleLog & { content: { title: string } | null; episode: { title: string } | null })[];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const retryMutation = useMutation({
    mutationFn: async (log: SubtitleLog) => {
      const { error } = await supabase.functions.invoke("generate-subtitles-auto", {
        body: {
          videoUrl: log.video_url,
          contentId: log.content_id,
          episodeId: log.episode_id,
          title: (log.metadata as any)?.title || "Untitled"
        }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subtitle generation restarted");
      queryClient.invalidateQueries({ queryKey: ["subtitle-generation-logs"] });
    },
    onError: (error) => {
      toast.error(`Failed to restart: ${error.message}`);
    }
  });

  const pendingCount = logs.filter(l => l.status === "pending" || l.status === "transcribing" || l.status === "translating").length;
  const completedCount = logs.filter(l => l.status === "completed").length;
  const failedCount = logs.filter(l => l.status === "failed").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Subtitle Generation Status
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-generated subtitles for uploaded videos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{completedCount}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-500">{failedCount}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
        </div>

        {/* Logs List */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Languages className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No subtitle generation logs yet</p>
              <p className="text-sm">Subtitles are auto-generated when videos are uploaded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <StatusIcon status={log.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {log.content?.title || "Unknown Content"}
                      </span>
                      {log.episode && (
                        <span className="text-sm text-muted-foreground">
                          • {log.episode.title}
                        </span>
                      )}
                      <StatusBadge status={log.status} />
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                      <span>
                        Started {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
                      </span>
                      {log.video_duration_seconds && (
                        <span>• Duration: {Math.round(log.video_duration_seconds / 60)} min</span>
                      )}
                      {log.languages_generated && log.languages_generated.length > 0 && (
                        <span>• Languages: {log.languages_generated.join(", ").toUpperCase()}</span>
                      )}
                    </div>

                    {log.error_message && (
                      <div className="mt-2 text-xs text-red-500 bg-red-500/10 p-2 rounded">
                        {log.error_message}
                      </div>
                    )}
                  </div>

                  {log.status === "failed" && log.video_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => retryMutation.mutate(log)}
                      disabled={retryMutation.isPending}
                    >
                      {retryMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Retry
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
