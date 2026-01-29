import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useIsAdmin = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (error) {
        console.error("Error checking admin role:", error);
        return false;
      }

      return data === true;
    },
    enabled: !!user,
  });
};

export const useAllUsers = () => {
  return useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      // Use profiles_safe view to exclude sensitive fields (pin_code, secret_word, etc.)
      const { data, error } = await supabase
        .from("profiles_safe")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useAllSubscriptions = () => {
  return useQuery({
    queryKey: ["all-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useUserRoles = () => {
  return useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useAddUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "moderator" | "user" }) => {
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
  });
};

export const useRemoveUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "moderator" | "user" }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
  });
};

export const useAdminContent = () => {
  return useQuery({
    queryKey: ["admin-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    refetchOnMount: true,
    staleTime: 0, // Always consider data stale to ensure refresh
  });
};

export const useCreateContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: {
      title: string;
      description?: string;
      thumbnail_url?: string;
      video_url?: string;
      genre?: string;
      content_type: string;
      is_premium?: boolean;
      duration?: number;
      year?: number;
      rating?: string;
      tmdb_id?: number | null;
      content_rating?: string;
      director?: string;
      cast_members?: any;
    }) => {
      const { data, error } = await supabase
        .from("content")
        .insert(content)
        .select()
        .single();

      if (error) throw error;
      
      // Trigger automatic email notification for new content
      try {
        await supabase.functions.invoke('notify-new-content', {
          body: {
            type: content.content_type === 'movie' ? 'new_movie' : 'new_tvshow',
            contentId: data.id,
            contentTitle: data.title,
            thumbnailUrl: data.thumbnail_url,
            description: data.description,
            genre: data.genre,
            year: data.year,
          },
        });
        console.log(`[useCreateContent] Notification triggered for new ${content.content_type}: ${data.title}`);
      } catch (notifyError) {
        // Don't fail content creation if notification fails
        console.error('[useCreateContent] Failed to send notification:', notifyError);
      }
      
      return data;
    },
    onSuccess: () => {
      // Invalidate all content-related queries to ensure list refresh
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      queryClient.invalidateQueries({ queryKey: ["content"] });
      queryClient.invalidateQueries({ queryKey: ["tv-trending"] });
      queryClient.invalidateQueries({ queryKey: ["tv-movies"] });
      queryClient.invalidateQueries({ queryKey: ["tv-series"] });
    },
  });
};

export const useUpdateContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from("content")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });
};

export const useDeleteContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("content")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });
};