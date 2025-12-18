import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Season {
  id: string;
  content_id: string;
  season_number: number;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  year: number | null;
  created_at: string;
  updated_at: string;
}

export interface Episode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  duration: number;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export const useSeasons = (contentId: string) => {
  return useQuery({
    queryKey: ['seasons', contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('content_id', contentId)
        .order('season_number', { ascending: true });
      
      if (error) throw error;
      return data as Season[];
    },
    enabled: !!contentId,
  });
};

export const useEpisodes = (seasonId: string) => {
  return useQuery({
    queryKey: ['episodes', seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('episodes')
        .select('*')
        .eq('season_id', seasonId)
        .order('episode_number', { ascending: true });
      
      if (error) throw error;
      return data as Episode[];
    },
    enabled: !!seasonId,
  });
};

export const useCreateSeason = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (season: Omit<Season, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('seasons')
        .insert(season)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['seasons', variables.content_id] });
    },
  });
};

export const useUpdateSeason = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Season> & { id: string }) => {
      const { data, error } = await supabase
        .from('seasons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
    },
  });
};

export const useDeleteSeason = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('seasons')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
    },
  });
};

export const useCreateEpisode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (episode: Omit<Episode, 'id' | 'created_at' | 'updated_at'>) => {
      // Use upsert to handle duplicate episode numbers gracefully
      const { data, error } = await supabase
        .from('episodes')
        .upsert({
          ...episode,
          video_url: episode.video_url?.trim() || null,
        }, {
          onConflict: 'season_id,episode_number',
          ignoreDuplicates: false,
        })
        .select()
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['episodes', variables.season_id] });
    },
  });
};

export const useUpdateEpisode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Episode> & { id: string }) => {
      const nextUpdates: Partial<Episode> = {
        ...updates,
        ...(updates.video_url !== undefined
          ? { video_url: updates.video_url?.trim() || null }
          : null),
      };

      const { data, error } = await supabase
        .from('episodes')
        .update(nextUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
    },
  });
};

export const useDeleteEpisode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('episodes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
    },
  });
};

export const useReorderEpisodes = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: { id: string; episode_number: number }[]) => {
      // Update all episodes in parallel
      const promises = updates.map(({ id, episode_number }) =>
        supabase
          .from('episodes')
          .update({ episode_number })
          .eq('id', id)
      );
      
      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        throw new Error('Failed to reorder some episodes');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
    },
  });
};
