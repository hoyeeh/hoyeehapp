import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WalkthroughScreen {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useWalkthroughScreens = () => {
  return useQuery({
    queryKey: ["walkthrough-screens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("walkthrough_screens")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as WalkthroughScreen[];
    },
  });
};

export const useAdminWalkthroughScreens = () => {
  return useQuery({
    queryKey: ["admin-walkthrough-screens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("walkthrough_screens")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as WalkthroughScreen[];
    },
  });
};

export const useCreateWalkthroughScreen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (screen: {
      title: string;
      description?: string;
      image_url: string;
      display_order: number;
    }) => {
      const { data, error } = await supabase
        .from("walkthrough_screens")
        .insert(screen)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-walkthrough-screens"] });
      queryClient.invalidateQueries({ queryKey: ["walkthrough-screens"] });
    },
  });
};

export const useUpdateWalkthroughScreen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from("walkthrough_screens")
        .update(updates as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-walkthrough-screens"] });
      queryClient.invalidateQueries({ queryKey: ["walkthrough-screens"] });
    },
  });
};

export const useDeleteWalkthroughScreen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("walkthrough_screens")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-walkthrough-screens"] });
      queryClient.invalidateQueries({ queryKey: ["walkthrough-screens"] });
    },
  });
};
