import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle, XCircle, Clock, Play, RefreshCw, RotateCcw, Trash2, HardDrive, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { BatchTranscoding } from "./BatchTranscoding";
import { StorageAnalytics } from "./StorageAnalytics";

interface TranscodingJob {
  id: string;
  episode_id: string;
  source_url: string;
  output_url: string | null;
  status: string;
  format: string;
  progress: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  retry_count?: number;
  max_retries?: number;
  last_retry_at?: string | null;
  episodes?: {
    title: string;
    episode_number: number;
    seasons?: {
      season_number: number;
      content?: {
        title: string;
      };
    };
  };
}

const statusConfig = {
  pending: { icon: Clock, color: "bg-yellow-500/20 text-yellow-500", label: "Pending" },
  processing: { icon: Play, color: "bg-blue-500/20 text-blue-500", label: "Processing" },
  completed: { icon: CheckCircle, color: "bg-green-500/20 text-green-500", label: "Completed" },
  failed: { icon: XCircle, color: "bg-red-500/20 text-red-500", label: "Failed" },
};

export const TranscodingDashboard = () => {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'jobs' | 'batch' | 'storage'>('jobs');

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['all-transcoding-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transcoding_jobs')
        .select(`
          *,
          episodes (
            title,
            episode_number,
            seasons (
              season_number,
              content (
                title
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TranscodingJob[];
    },
    refetchInterval: 10000,
  });

  const retryJob = useMutation({
    mutationFn: async (job: TranscodingJob) => {
      // Update job status to pending and increment retry count
      const { error: updateError } = await supabase
        .from('transcoding_jobs')
        .update({
          status: 'pending',
          progress: 0,
          error_message: null,
          retry_count: (job.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      if (updateError) throw updateError;

      // Send to Mux for reprocessing
      const { error: muxError } = await supabase.functions.invoke('mux-video', {
        body: {
          action: 'ingest',
          sourceUrl: job.source_url,
          episodeId: job.episode_id,
          jobId: job.id,
        },
      });

      if (muxError) throw muxError;
    },
    onSuccess: () => {
      toast.success("Job requeued for transcoding");
      queryClient.invalidateQueries({ queryKey: ['all-transcoding-jobs'] });
    },
    onError: (error) => {
      toast.error(`Failed to retry job: ${error.message}`);
    },
  });

  const retryAllFailed = useMutation({
    mutationFn: async () => {
      const failedJobs = jobs.filter(j => j.status === 'failed' && (j.retry_count || 0) < (j.max_retries || 3));
      
      for (const job of failedJobs) {
        await retryJob.mutateAsync(job);
      }
    },
    onSuccess: () => {
      toast.success("All eligible failed jobs requeued");
    },
  });

  const deleteJob = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('transcoding_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job deleted");
      queryClient.invalidateQueries({ queryKey: ['all-transcoding-jobs'] });
    },
    onError: (error) => {
      toast.error(`Failed to delete job: ${error.message}`);
    },
  });

  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const processingJobs = jobs.filter(j => j.status === 'processing');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const failedJobs = jobs.filter(j => j.status === 'failed');
  const retriableJobs = failedJobs.filter(j => (j.retry_count || 0) < (j.max_retries || 3));

  const renderJobCard = (job: TranscodingJob) => {
    const config = statusConfig[job.status as keyof typeof statusConfig] || statusConfig.pending;
    const StatusIcon = config.icon;
    const episodeInfo = job.episodes;
    const showTitle = episodeInfo?.seasons?.content?.title || 'Unknown Show';
    const seasonNum = episodeInfo?.seasons?.season_number || 0;
    const episodeNum = episodeInfo?.episode_number || 0;
    const episodeTitle = episodeInfo?.title || 'Unknown Episode';
    const canRetry = job.status === 'failed' && (job.retry_count || 0) < (job.max_retries || 3);

    return (
      <Card key={job.id} className="bg-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className={config.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
                <Badge variant="outline">{job.format.toUpperCase()}</Badge>
                {(job.retry_count || 0) > 0 && (
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-500">
                    Retry {job.retry_count}/{job.max_retries || 3}
                  </Badge>
                )}
              </div>
              
              <h4 className="font-medium truncate">{showTitle}</h4>
              <p className="text-sm text-muted-foreground">
                S{seasonNum.toString().padStart(2, '0')}E{episodeNum.toString().padStart(2, '0')} - {episodeTitle}
              </p>
              
              {job.status === 'processing' && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Progress</span>
                    <span>{job.progress || 0}%</span>
                  </div>
                  <Progress value={job.progress || 0} className="h-2" />
                </div>
              )}

              {job.status === 'failed' && job.error_message && (
                <p className="text-sm text-destructive mt-2">{job.error_message}</p>
              )}

              <p className="text-xs text-muted-foreground mt-2">
                Created {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                {job.last_retry_at && (
                  <> • Last retry {formatDistanceToNow(new Date(job.last_retry_at), { addSuffix: true })}</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {canRetry && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => retryJob.mutate(job)}
                  disabled={retryJob.isPending}
                  title="Retry transcoding"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              {(job.status === 'failed' || job.status === 'completed') && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm('Delete this transcoding job?')) {
                      deleteJob.mutate(job.id);
                    }
                  }}
                  disabled={deleteJob.isPending}
                  title="Delete job"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-display">Transcoding Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={activeView === 'jobs' ? 'default' : 'outline'}
            onClick={() => setActiveView('jobs')}
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            Jobs
          </Button>
          <Button
            variant={activeView === 'batch' ? 'default' : 'outline'}
            onClick={() => setActiveView('batch')}
            size="sm"
          >
            <Database className="h-4 w-4 mr-2" />
            Batch
          </Button>
          <Button
            variant={activeView === 'storage' ? 'default' : 'outline'}
            onClick={() => setActiveView('storage')}
            size="sm"
          >
            <HardDrive className="h-4 w-4 mr-2" />
            Storage
          </Button>
        </div>
      </div>

      {activeView === 'batch' && <BatchTranscoding onComplete={() => refetch()} />}
      {activeView === 'storage' && <StorageAnalytics />}

      {activeView === 'jobs' && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  <span className="text-2xl font-bold">{pendingJobs.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  <span className="text-2xl font-bold">{processingJobs.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">{completedJobs.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-2xl font-bold">{failedJobs.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => refetch()} size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {retriableJobs.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => retryAllFailed.mutate()}
                disabled={retryAllFailed.isPending}
                size="sm"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry All Failed ({retriableJobs.length})
              </Button>
            )}
          </div>

          {/* Jobs Tabs */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">All ({jobs.length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingJobs.length})</TabsTrigger>
              <TabsTrigger value="processing">Processing ({processingJobs.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedJobs.length})</TabsTrigger>
              <TabsTrigger value="failed">Failed ({failedJobs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="grid gap-4">
                {jobs.length === 0 ? (
                  <Card className="bg-card">
                    <CardContent className="p-8 text-center text-muted-foreground">
                      No transcoding jobs found
                    </CardContent>
                  </Card>
                ) : (
                  jobs.map(renderJobCard)
                )}
              </div>
            </TabsContent>

            <TabsContent value="pending" className="mt-4">
              <div className="grid gap-4">
                {pendingJobs.length === 0 ? (
                  <Card className="bg-card">
                    <CardContent className="p-8 text-center text-muted-foreground">
                      No pending jobs
                    </CardContent>
                  </Card>
                ) : (
                  pendingJobs.map(renderJobCard)
                )}
              </div>
            </TabsContent>

            <TabsContent value="processing" className="mt-4">
              <div className="grid gap-4">
                {processingJobs.length === 0 ? (
                  <Card className="bg-card">
                    <CardContent className="p-8 text-center text-muted-foreground">
                      No jobs currently processing
                    </CardContent>
                  </Card>
                ) : (
                  processingJobs.map(renderJobCard)
                )}
              </div>
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              <div className="grid gap-4">
                {completedJobs.length === 0 ? (
                  <Card className="bg-card">
                    <CardContent className="p-8 text-center text-muted-foreground">
                      No completed jobs
                    </CardContent>
                  </Card>
                ) : (
                  completedJobs.map(renderJobCard)
                )}
              </div>
            </TabsContent>

            <TabsContent value="failed" className="mt-4">
              <div className="grid gap-4">
                {failedJobs.length === 0 ? (
                  <Card className="bg-card">
                    <CardContent className="p-8 text-center text-muted-foreground">
                      No failed jobs
                    </CardContent>
                  </Card>
                ) : (
                  failedJobs.map(renderJobCard)
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};