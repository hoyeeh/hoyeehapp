import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreatorProfile } from "./useCreator";
import { toast } from "sonner";

export type SocialPlatform = "youtube" | "facebook" | "tiktok" | "instagram";

export const useCreatorSocialAccounts = () => {
  const { data: creatorProfile } = useCreatorProfile();
  
  return useQuery({
    queryKey: ["creator-social-accounts", creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile) return [];
      
      const { data, error } = await supabase
        .from("creator_social_accounts")
        .select("*")
        .eq("creator_id", creatorProfile.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!creatorProfile,
  });
};

export const useConnectSocialPlatform = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      platform, 
      channelId, 
      username 
    }: { 
      platform: SocialPlatform; 
      channelId?: string; 
      username?: string; 
    }) => {
      const { data, error } = await supabase.functions.invoke("creator-social-import", {
        body: {
          action: "connect",
          platform,
          channelId,
          username,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-social-accounts"] });
      toast.success("Account connected successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to connect account");
    },
  });
};

export const useDisconnectSocialPlatform = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (platform: SocialPlatform) => {
      const { data, error } = await supabase.functions.invoke("creator-social-import", {
        body: {
          action: "disconnect",
          platform,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-social-accounts"] });
      toast.success("Account disconnected");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to disconnect account");
    },
  });
};

export const useImportYouTubeContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (channelId: string) => {
      const { data, error } = await supabase.functions.invoke("creator-social-import", {
        body: {
          action: "fetch-youtube",
          channelId,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["creator-imported-content"] });
      queryClient.invalidateQueries({ queryKey: ["creator-social-accounts"] });
      toast.success(`Imported ${data.imported} videos from YouTube`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to import YouTube content");
    },
  });
};

export const useCreatorImportedContent = (creatorId?: string) => {
  const { data: creatorProfile } = useCreatorProfile();
  const id = creatorId || creatorProfile?.id;
  
  return useQuery({
    queryKey: ["creator-imported-content", id],
    queryFn: async () => {
      if (!id) return [];
      
      const { data, error } = await supabase
        .from("creator_imported_content")
        .select("*")
        .eq("creator_id", id)
        .order("original_published_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useImportFromYouTube = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ creatorId, platform, videos }: { creatorId: string; platform: string; videos: any[] }) => {
      const { data, error } = await supabase
        .from("creator_imported_content")
        .insert(videos.map(v => ({
          creator_id: creatorId,
          platform,
          ...v,
        })));
      
      if (error) throw error;
      return { success: true, imported: videos.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-imported-content"] });
    },
  });
};

export const useConvertToPaidContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      importedContentId, 
      price 
    }: { 
      importedContentId: string; 
      price: number; 
    }) => {
      // Get the imported content
      const { data: imported, error: fetchError } = await supabase
        .from("creator_imported_content")
        .select("*")
        .eq("id", importedContentId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Get creator profile
      const { data: profile, error: profileError } = await supabase
        .from("creator_profiles")
        .select("id, user_id")
        .eq("id", imported.creator_id)
        .single();
      
      if (profileError) throw profileError;
      
      // Create content entry
      const { data: content, error: contentError } = await supabase
        .from("content")
        .insert({
          title: imported.title,
          description: imported.description,
          thumbnail_url: imported.thumbnail_url,
          video_url: imported.video_url,
          duration: imported.duration,
          content_type: "movie",
          created_by: profile.user_id,
        })
        .select()
        .single();
      
      if (contentError) throw contentError;
      
      // Create paid content entry
      const { error: paidError } = await supabase
        .from("paid_content")
        .insert({
          content_id: content.id,
          creator_id: profile.id,
          price,
          currency: "XAF",
        });
      
      if (paidError) throw paidError;
      
      // Update imported content
      await supabase
        .from("creator_imported_content")
        .update({
          is_imported_to_content: true,
          imported_content_id: content.id,
        })
        .eq("id", importedContentId);
      
      return content;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-imported-content"] });
      queryClient.invalidateQueries({ queryKey: ["creator-content"] });
      toast.success("Content converted to paid content!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to convert content");
    },
  });
};
