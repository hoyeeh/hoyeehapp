import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useIsSuperAdmin = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-super-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase.rpc("is_super_admin", {
        _user_id: user.id,
      });

      if (error) {
        console.error("Error checking super admin role:", error);
        return false;
      }

      return data === true;
    },
    enabled: !!user,
  });
};

export const usePromoteToAdmin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: "admin",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
  });
};

export const usePromoteToSuperAdmin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: "super_admin" as any,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
  });
};

export const useDemoteFromRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "moderator" | "user" | "super_admin" }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      // Delete user roles first
      await supabase.from("user_roles").delete().eq("user_id", userId);
      
      // Delete user profile
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
  });
};

export const useDeleteContent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contentId }: { contentId: string }) => {
      // Delete related data first
      await supabase.from("watchlist").delete().eq("content_id", contentId);
      await supabase.from("watch_history").delete().eq("content_id", contentId);
      await supabase.from("reviews").delete().eq("content_id", contentId);
      await supabase.from("top_10").delete().eq("content_id", contentId);
      await supabase.from("section_content").delete().eq("content_id", contentId);
      
      // Delete seasons and episodes
      const { data: seasons } = await supabase
        .from("seasons")
        .select("id")
        .eq("content_id", contentId);
      
      if (seasons) {
        for (const season of seasons) {
          await supabase.from("episodes").delete().eq("season_id", season.id);
        }
        await supabase.from("seasons").delete().eq("content_id", contentId);
      }
      
      // Finally delete content
      const { error } = await supabase
        .from("content")
        .delete()
        .eq("id", contentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      queryClient.invalidateQueries({ queryKey: ["content"] });
    },
  });
};

export const useSystemSettings = () => {
  return useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_settings")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useUpdateSubscriptionSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from("subscription_settings")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    },
  });
};
