import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TranscodingJob {
  id: string;
  episode_id: string;
  source_url: string;
  output_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: string;
  progress: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export const useTranscodingStatus = (episodeId: string) => {
  return useQuery({
    queryKey: ['transcoding', episodeId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('transcode-video', {
        body: { action: 'status', episodeId },
      });
      
      if (error) throw error;
      return data?.job as TranscodingJob | null;
    },
    enabled: !!episodeId,
    refetchInterval: (query) => {
      // Poll every 5 seconds if job is in progress
      const job = query.state.data;
      if (job && (job.status === 'pending' || job.status === 'processing')) {
        return 5000;
      }
      return false;
    },
  });
};

export const useQueueTranscoding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ episodeId, sourceUrl, format = 'hls' }: { 
      episodeId: string; 
      sourceUrl: string; 
      format?: 'hls' | 'dash';
    }) => {
      const { data, error } = await supabase.functions.invoke('transcode-video', {
        body: { action: 'queue', episodeId, sourceUrl, format },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transcoding', variables.episodeId] });
    },
  });
};
