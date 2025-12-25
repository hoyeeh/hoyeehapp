import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useKidsApprovedContent = (profileId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: approvedContent = [], isLoading } = useQuery({
    queryKey: ["kids-approved-content", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("kids_approved_content")
        .select(`
          id,
          content_id,
          approved_at,
          notes,
          content:content_id(id, title, thumbnail_url, genre, content_rating, content_type)
        `)
        .eq("profile_id", profileId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profileId,
  });

  const approveContent = useMutation({
    mutationFn: async ({ contentId, notes }: { contentId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !profileId) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("kids_approved_content")
        .insert({
          parent_user_id: user.id,
          profile_id: profileId,
          content_id: contentId,
          notes,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-approved-content", profileId] });
      toast.success("Content approved for this profile");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.info("Content already approved");
      } else {
        toast.error("Failed to approve content");
      }
    },
  });

  const removeApproval = useMutation({
    mutationFn: async (contentId: string) => {
      const { error } = await supabase
        .from("kids_approved_content")
        .delete()
        .eq("profile_id", profileId)
        .eq("content_id", contentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kids-approved-content", profileId] });
      toast.success("Approval removed");
    },
    onError: () => {
      toast.error("Failed to remove approval");
    },
  });

  const isContentApproved = (contentId: string) => {
    return approvedContent.some((item: any) => item.content_id === contentId);
  };

  return {
    approvedContent,
    isLoading,
    approveContent,
    removeApproval,
    isContentApproved,
  };
};

export const useKidsProfileRequiresApproval = (profileId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: requiresApproval = false } = useQuery({
    queryKey: ["kids-requires-approval", profileId],
    queryFn: async () => {
      if (!profileId) return false;

      const { data, error } = await supabase
        .from("user_profiles")
        .select("require_parent_approval")
        .eq("id", profileId)
        .single();

      if (error) return false;
      return data?.require_parent_approval || false;
    },
    enabled: !!profileId,
  });

  const toggleRequiresApproval = useMutation({
    mutationFn: async (requires: boolean) => {
      if (!profileId) throw new Error("No profile");

      const { error } = await supabase
        .from("user_profiles")
        .update({ require_parent_approval: requires })
        .eq("id", profileId);

      if (error) throw error;
    },
    onSuccess: (_, requires) => {
      queryClient.invalidateQueries({ queryKey: ["kids-requires-approval", profileId] });
      toast.success(requires ? "Parent approval now required" : "Parent approval disabled");
    },
    onError: () => {
      toast.error("Failed to update setting");
    },
  });

  return {
    requiresApproval,
    toggleRequiresApproval,
  };
};