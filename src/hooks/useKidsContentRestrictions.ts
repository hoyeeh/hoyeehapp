import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type RestrictionType = "approved" | "blocked";

export interface ContentRestriction {
  id: string;
  profile_id: string;
  content_id: string;
  parent_user_id: string;
  restriction_type: RestrictionType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useKidsContentRestrictions = (profileId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["kids-content-restrictions", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("kids_content_restrictions")
        .select(`
          *,
          content:content_id(id, title, thumbnail_url, content_type, content_rating)
        `)
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!profileId,
  });
};

export const useAllKidsContentRestrictions = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["all-kids-content-restrictions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_content_restrictions")
        .select(`
          *,
          content:content_id(id, title, thumbnail_url, content_type, content_rating),
          profile:profile_id(id, name, avatar_url)
        `)
        .eq("parent_user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
};

export const useSetContentRestriction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      contentId,
      restrictionType,
      notes,
    }: {
      profileId: string;
      contentId: string;
      restrictionType: RestrictionType;
      notes?: string;
    }) => {
      if (!user) throw new Error("User not authenticated");

      // Use upsert to handle both insert and update
      const { data, error } = await supabase
        .from("kids_content_restrictions")
        .upsert(
          {
            profile_id: profileId,
            content_id: contentId,
            parent_user_id: user.id,
            restriction_type: restrictionType,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "profile_id,content_id",
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["kids-content-restrictions", variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ["all-kids-content-restrictions"] });
      toast.success(
        variables.restrictionType === "approved"
          ? "Content approved for this profile"
          : "Content blocked for this profile"
      );
    },
    onError: (error: any) => {
      console.error("Error setting content restriction:", error);
      toast.error("Failed to update content restriction");
    },
  });
};

export const useRemoveContentRestriction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      profileId,
      contentId,
    }: {
      profileId: string;
      contentId: string;
    }) => {
      const { error } = await supabase
        .from("kids_content_restrictions")
        .delete()
        .eq("profile_id", profileId)
        .eq("content_id", contentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["kids-content-restrictions", variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ["all-kids-content-restrictions"] });
      toast.success("Content restriction removed");
    },
    onError: (error: any) => {
      console.error("Error removing content restriction:", error);
      toast.error("Failed to remove content restriction");
    },
  });
};

export const useContentRestrictionStatus = (profileId?: string, contentId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["content-restriction-status", profileId, contentId],
    queryFn: async () => {
      if (!profileId || !contentId) return null;

      const { data, error } = await supabase
        .from("kids_content_restrictions")
        .select("restriction_type")
        .eq("profile_id", profileId)
        .eq("content_id", contentId)
        .maybeSingle();

      if (error) throw error;
      return data?.restriction_type || null;
    },
    enabled: !!user && !!profileId && !!contentId,
  });
};
