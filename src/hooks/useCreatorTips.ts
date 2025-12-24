import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatorProfile } from "./useCreator";
import { toast } from "sonner";

export const useCreatorTips = (creatorIdProp?: string) => {
  const { data: creatorProfile } = useCreatorProfile();
  const creatorId = creatorIdProp || creatorProfile?.id;
  
  return useQuery({
    queryKey: ["creator-tips", creatorId],
    queryFn: async () => {
      if (!creatorId) return [];
      
      const { data, error } = await supabase
        .from("creator_tips")
        .select("*")
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!creatorId,
  });
};

export const useTipStats = (creatorIdProp?: string) => {
  const { data: creatorProfile } = useCreatorProfile();
  const creatorId = creatorIdProp || creatorProfile?.id;
  
  return useQuery({
    queryKey: ["tip-stats", creatorId],
    queryFn: async () => {
      if (!creatorId) return null;
      
      const { data, error } = await supabase
        .from("creator_tips")
        .select("amount, created_at")
        .eq("creator_id", creatorId)
        .eq("status", "completed");
      
      if (error) throw error;
      
      const totalTips = data.reduce((sum, tip) => sum + Number(tip.amount), 0);
      const tipCount = data.length;
      
      // Calculate this month's tips
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthTips = data
        .filter(tip => new Date(tip.created_at) >= startOfMonth)
        .reduce((sum, tip) => sum + Number(tip.amount), 0);
      
      return {
        totalTips,
        tipCount,
        thisMonthTips,
        averageTip: tipCount > 0 ? totalTips / tipCount : 0,
      };
    },
    enabled: !!creatorId,
  });
};

export const useSendTip = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      creatorId, 
      amount, 
      message 
    }: { 
      creatorId: string; 
      amount: number; 
      message?: string; 
    }) => {
      const { data, error } = await supabase.functions.invoke("creator-tip", {
        body: {
          action: "initialize",
          creatorId,
          amount,
          message,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send tip");
    },
  });
};

export const useVerifyTip = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (txRef: string) => {
      const { data, error } = await supabase.functions.invoke("creator-tip", {
        body: {
          action: "verify",
          txRef,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-tips"] });
      queryClient.invalidateQueries({ queryKey: ["tip-stats"] });
      toast.success("Tip sent successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to verify tip");
    },
  });
};

export const useMyTipHistory = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["my-tip-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("creator_tips")
        .select("*, creator_profiles(display_name, avatar_url)")
        .eq("tipper_user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};
