import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const useCreatorFollowers = (creatorId: string) => {
  return useQuery({
    queryKey: ["creator-followers", creatorId],
    queryFn: async () => {
      if (!creatorId) return [];
      
      const { data, error } = await supabase
        .from("creator_followers")
        .select("*, profiles:follower_user_id(display_name, avatar_url)")
        .eq("creator_id", creatorId)
        .order("followed_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!creatorId,
  });
};

export const useFollowerCount = (creatorId: string) => {
  return useQuery({
    queryKey: ["follower-count", creatorId],
    queryFn: async () => {
      if (!creatorId) return 0;
      
      const { count, error } = await supabase
        .from("creator_followers")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", creatorId);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!creatorId,
  });
};

export const useIsFollowing = (creatorId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["is-following", creatorId, user?.id],
    queryFn: async () => {
      if (!user || !creatorId) return false;
      
      const { data, error } = await supabase
        .from("creator_followers")
        .select("id")
        .eq("creator_id", creatorId)
        .eq("follower_user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!creatorId,
  });
};

export const useFollowCreator = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (creatorId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("creator_followers")
        .insert({
          creator_id: creatorId,
          follower_user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, creatorId) => {
      queryClient.invalidateQueries({ queryKey: ["is-following", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["follower-count", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["creator-followers", creatorId] });
      toast.success("Now following!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to follow");
    },
  });
};

export const useUnfollowCreator = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (creatorId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("creator_followers")
        .delete()
        .eq("creator_id", creatorId)
        .eq("follower_user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: (_, creatorId) => {
      queryClient.invalidateQueries({ queryKey: ["is-following", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["follower-count", creatorId] });
      queryClient.invalidateQueries({ queryKey: ["creator-followers", creatorId] });
      toast.success("Unfollowed");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to unfollow");
    },
  });
};

export const useMyFollowedCreators = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["my-followed-creators", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Use public view for creator data to exclude sensitive financial fields
      const { data, error } = await supabase
        .from("creator_followers")
        .select("creator_id, creator_profiles_public(id, display_name, avatar_url, is_verified, follower_count)")
        .eq("follower_user_id", user.id)
        .order("followed_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};
