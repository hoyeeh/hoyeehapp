import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface YouTubeChannel {
  id: string;
  name: string;
  channel_id: string;
  description: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  is_active: boolean;
  is_kids_friendly: boolean;
  kids_category_id: string | null;
  display_order: number;
}

export const useKidsYouTubeChannels = () => {
  return useQuery({
    queryKey: ["admin-kids-youtube-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_channels")
        .select("*")
        .order("display_order");
      
      if (error) throw error;
      return data as YouTubeChannel[];
    },
  });
};

export const useToggleKidsFriendly = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, isKidsFriendly }: { id: string; isKidsFriendly: boolean }) => {
      const { error } = await supabase
        .from("youtube_channels")
        .update({ is_kids_friendly: isKidsFriendly })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-youtube-channels"] });
      queryClient.invalidateQueries({ queryKey: ["kids-youtube-videos"] });
      toast.success("Channel updated!");
    },
    onError: () => {
      toast.error("Failed to update channel");
    },
  });
};

export const useUpdateKidsCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
      const { error } = await supabase
        .from("youtube_channels")
        .update({ kids_category_id: categoryId })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-youtube-channels"] });
      toast.success("Category updated!");
    },
    onError: () => {
      toast.error("Failed to update category");
    },
  });
};
