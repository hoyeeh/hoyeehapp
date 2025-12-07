import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Content } from "@/types";

// Fetch all content
export const useContent = () => {
  return useQuery({
    queryKey: ["content"],
    queryFn: async (): Promise<Content[]> => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description || "",
        thumbnailUrl: item.thumbnail_url || "",
        videoUrl: item.video_url || "",
        genre: item.genre || "",
        contentType: item.content_type as "movie" | "series",
        isPremium: item.is_premium || false,
        duration: item.duration || 0,
        year: item.year || undefined,
        rating: item.rating || undefined,
      }));
    },
  });
};

// Fetch user's watchlist
export const useWatchlist = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["watchlist", user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("watchlist")
        .select("content_id")
        .eq("user_id", user.id);

      if (error) throw error;

      return (data || []).map((item) => item.content_id);
    },
    enabled: !!user,
  });
};

// Add to watchlist
export const useAddToWatchlist = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contentId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("watchlist").insert({
        user_id: user.id,
        content_id: contentId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
};

// Remove from watchlist
export const useRemoveFromWatchlist = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contentId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("content_id", contentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
};

// Update watch history
export const useUpdateWatchHistory = () => {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ contentId, progress }: { contentId: string; progress: number }) => {
      if (!user) return;

      const { error } = await supabase.from("watch_history").upsert(
        {
          user_id: user.id,
          content_id: contentId,
          progress,
          last_watched: new Date().toISOString(),
        },
        { onConflict: "user_id,content_id" }
      );

      if (error) throw error;
    },
  });
};

// Fetch user profile
export const useProfile = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};
