import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GenerateSubtitlesParams {
  videoUrl: string;
  contentId: string;
  episodeId?: string;
  title: string;
}

export const useSubtitleGeneration = () => {
  const queryClient = useQueryClient();

  const generateSubtitles = useMutation({
    mutationFn: async ({ videoUrl, contentId, episodeId, title }: GenerateSubtitlesParams) => {
      const { data, error } = await supabase.functions.invoke("generate-subtitles-auto", {
        body: { videoUrl, contentId, episodeId, title }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      if (data.silentVideo) {
        toast.info(`No speech detected in "${variables.title}"`, {
          description: "The video appears to be silent or have no dialogue",
        });
      } else {
        toast.success(`Subtitles generated for "${variables.title}"`, {
          description: `${data.segmentCount} segments, ${data.englishSubtitle?.wordCount || 0} words`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["subtitles"] });
      queryClient.invalidateQueries({ queryKey: ["subtitle-generation-logs"] });
    },
    onError: (error, variables) => {
      console.error("Subtitle generation failed:", error);
      toast.error(`Failed to generate subtitles for "${variables.title}"`, {
        description: error.message,
      });
    }
  });

  const triggerSubtitleGeneration = async (params: GenerateSubtitlesParams) => {
    // Fire and forget - don't await
    generateSubtitles.mutate(params);
    toast.info(`Generating subtitles for "${params.title}"...`, {
      description: "English transcription and French translation will be created automatically",
      duration: 5000,
    });
  };

  return {
    generateSubtitles,
    triggerSubtitleGeneration,
    isGenerating: generateSubtitles.isPending,
  };
};
