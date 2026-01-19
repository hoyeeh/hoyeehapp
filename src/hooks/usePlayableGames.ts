import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlayableGame {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string;
  embed_url: string;
  source: string;
  embed_type: "iframe" | "external";
  tags: string[];
  age_group: string | null;
  languages: string[];
  subject: string | null;
  is_verified: boolean;
  is_active: boolean;
  display_order: number;
  health_status: "healthy" | "broken" | "unknown";
  last_health_check: string | null;
  play_count: number;
  created_at: string;
  updated_at: string;
}

export const usePlayableGames = () => {
  return useQuery({
    queryKey: ["playable-games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playable_games")
        .select("*")
        .eq("is_verified", true)
        .eq("is_active", true)
        .neq("health_status", "broken")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as PlayableGame[];
    },
  });
};

// Hook to fetch featured/curated games
export const useFeaturedGames = () => {
  return useQuery({
    queryKey: ["featured-games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playable_games")
        .select("*")
        .eq("is_verified", true)
        .eq("is_active", true)
        .eq("featured", true)
        .neq("health_status", "broken")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as PlayableGame[];
    },
  });
};

export const useAllPlayableGames = () => {
  return useQuery({
    queryKey: ["all-playable-games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playable_games")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as PlayableGame[];
    },
  });
};

export const useCreatePlayableGame = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (game: Omit<PlayableGame, "id" | "created_at" | "updated_at" | "play_count" | "last_health_check">) => {
      const { data, error } = await supabase
        .from("playable_games")
        .insert(game)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playable-games"] });
      queryClient.invalidateQueries({ queryKey: ["all-playable-games"] });
    },
  });
};

export const useUpdatePlayableGame = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlayableGame> & { id: string }) => {
      const { error } = await supabase
        .from("playable_games")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playable-games"] });
      queryClient.invalidateQueries({ queryKey: ["all-playable-games"] });
    },
  });
};

export const useDeletePlayableGame = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("playable_games")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playable-games"] });
      queryClient.invalidateQueries({ queryKey: ["all-playable-games"] });
    },
  });
};

export const useIncrementPlayCount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: current } = await supabase
        .from("playable_games")
        .select("play_count")
        .eq("id", id)
        .single();

      const { error } = await supabase
        .from("playable_games")
        .update({ play_count: (current?.play_count || 0) + 1 })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playable-games"] });
    },
  });
};
