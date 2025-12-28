import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FeaturedCreator {
  id: string;
  creator_id: string;
  title: string;
  subtitle: string | null;
  banner_image_url: string;
  cta_label: string;
  priority: number;
  status: string;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  creator_profiles?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
    bio: string | null;
  };
}

export function useFeaturedCreators() {
  return useQuery({
    queryKey: ['featured-creators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('featured_creators')
        .select(`
          *,
          creator_profiles (
            id,
            display_name,
            avatar_url,
            is_verified,
            bio
          )
        `)
        .eq('status', 'active')
        .order('priority', { ascending: false });

      if (error) throw error;
      return data as FeaturedCreator[];
    },
  });
}

export function useAdminFeaturedCreators() {
  return useQuery({
    queryKey: ['admin-featured-creators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('featured_creators')
        .select(`
          *,
          creator_profiles (
            id,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .order('priority', { ascending: false });

      if (error) throw error;
      return data as FeaturedCreator[];
    },
  });
}

export function useCreateFeaturedCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      creator_id: string;
      title: string;
      subtitle?: string;
      banner_image_url: string;
      cta_label?: string;
      priority?: number;
      status?: string;
      start_at?: string;
      end_at?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('featured_creators')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featured-creators'] });
      queryClient.invalidateQueries({ queryKey: ['admin-featured-creators'] });
    },
  });
}

export function useUpdateFeaturedCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      creator_id?: string;
      title?: string;
      subtitle?: string;
      banner_image_url?: string;
      cta_label?: string;
      priority?: number;
      status?: string;
      start_at?: string | null;
      end_at?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from('featured_creators')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featured-creators'] });
      queryClient.invalidateQueries({ queryKey: ['admin-featured-creators'] });
    },
  });
}

export function useDeleteFeaturedCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('featured_creators')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featured-creators'] });
      queryClient.invalidateQueries({ queryKey: ['admin-featured-creators'] });
    },
  });
}
