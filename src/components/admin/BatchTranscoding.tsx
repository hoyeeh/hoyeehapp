import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, CheckCircle, Video, Film } from "lucide-react";
import { toast } from "sonner";

interface Episode {
  id: string;
  title: string;
  episode_number: number;
  video_url: string | null;
  seasons: {
    season_number: number;
    content: {
      id: string;
      title: string;
    };
  };
}

interface BatchTranscodingProps {
  onComplete?: () => void;
}

export const BatchTranscoding = ({ onComplete }: BatchTranscodingProps) => {
  const queryClient = useQueryClient();
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  // Fetch episodes without HLS transcoding
  const { data: untranscodedEpisodes = [], isLoading } = useQuery({
    queryKey: ['untranscoded-episodes'],
    queryFn: async () => {
      // Get all episodes with video URLs
      const { data: episodes, error: episodesError } = await supabase
        .from('episodes')
        .select(`
          id,
          title,
          episode_number,
          video_url,
          seasons (
            season_number,
            content (
              id,
              title
            )
          )
        `)
        .not('video_url', 'is', null)
        .order('created_at', { ascending: false });

      if (episodesError) throw episodesError;

      // Get existing transcoding jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('transcoding_jobs')
        .select('episode_id, status')
        .in('status', ['pending', 'processing', 'completed']);

      if (jobsError) throw jobsError;

      const transcodedEpisodeIds = new Set(jobs?.map(j => j.episode_id) || []);

      // Filter to episodes that haven't been transcoded
      return (episodes || []).filter(ep => 
        !transcodedEpisodeIds.has(ep.id) && 
        ep.video_url && 
        !ep.video_url.includes('.m3u8')
      ) as Episode[];
    },
  });

  const handleSelectAll = () => {
    if (selectedEpisodes.size === untranscodedEpisodes.length) {
      setSelectedEpisodes(new Set());
    } else {
      setSelectedEpisodes(new Set(untranscodedEpisodes.map(e => e.id)));
    }
  };

  const handleToggleEpisode = (episodeId: string) => {
    const newSelected = new Set(selectedEpisodes);
    if (newSelected.has(episodeId)) {
      newSelected.delete(episodeId);
    } else {
      newSelected.add(episodeId);
    }
    setSelectedEpisodes(newSelected);
  };

  const startBatchTranscoding = async () => {
    if (selectedEpisodes.size === 0) {
      toast.error("Please select at least one episode");
      return;
    }

    setIsProcessing(true);
    setProcessedCount(0);

    const episodesToProcess = untranscodedEpisodes.filter(e => selectedEpisodes.has(e.id));

    for (let i = 0; i < episodesToProcess.length; i++) {
      const episode = episodesToProcess[i];
      
      try {
        // Queue the transcoding job
        const { data: jobData, error: queueError } = await supabase.functions.invoke('transcode-video', {
          body: {
            action: 'queue',
            episodeId: episode.id,
            sourceUrl: episode.video_url,
            format: 'hls',
          },
        });

        if (queueError) throw queueError;

        // Send to Mux
        await supabase.functions.invoke('mux-video', {
          body: {
            action: 'ingest',
            sourceUrl: episode.video_url,
            episodeId: episode.id,
            jobId: jobData?.job?.id,
          },
        });

        setProcessedCount(i + 1);
      } catch (error) {
        console.error(`Failed to queue episode ${episode.id}:`, error);
        toast.error(`Failed to queue: ${episode.title}`);
      }

      // Small delay between requests to avoid rate limiting
      if (i < episodesToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsProcessing(false);
    setSelectedEpisodes(new Set());
    toast.success(`Queued ${processedCount + 1} episodes for transcoding`);
    queryClient.invalidateQueries({ queryKey: ['untranscoded-episodes'] });
    queryClient.invalidateQueries({ queryKey: ['all-transcoding-jobs'] });
    onComplete?.();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          Batch Transcoding
        </CardTitle>
        <CardDescription>
          Select multiple episodes to queue for HLS transcoding at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Processing episodes...</span>
              <span>{processedCount}/{selectedEpisodes.size}</span>
            </div>
            <Progress value={(processedCount / selectedEpisodes.size) * 100} />
          </div>
        )}

        {untranscodedEpisodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>All episodes have been transcoded!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedEpisodes.size === untranscodedEpisodes.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  Select All ({untranscodedEpisodes.length} episodes)
                </span>
              </div>
              <Button
                onClick={startBatchTranscoding}
                disabled={isProcessing || selectedEpisodes.size === 0}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Transcoding ({selectedEpisodes.size})
              </Button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {untranscodedEpisodes.map((episode) => (
                <div
                  key={episode.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedEpisodes.has(episode.id)}
                    onCheckedChange={() => handleToggleEpisode(episode.id)}
                  />
                  <Video className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{episode.seasons?.content?.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      S{episode.seasons?.season_number?.toString().padStart(2, '0')}
                      E{episode.episode_number.toString().padStart(2, '0')} - {episode.title}
                    </p>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0">
                    Needs HLS
                  </Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};