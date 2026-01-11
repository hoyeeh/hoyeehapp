import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Content } from "@/types";

// Fetch all content with pagination to get all items (Supabase default limit is 1000)
export const useContent = () => {
  return useQuery({
    queryKey: ["content"],
    queryFn: async (): Promise<Content[]> => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        const { data, error } = await supabase
          .from("content")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      return allData.map((item) => ({
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
        contentRating: item.content_rating || undefined,
        createdAt: item.created_at || undefined,
        cast_members: item.cast_members || undefined,
        ageLimit: item.age_limit || undefined,
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
