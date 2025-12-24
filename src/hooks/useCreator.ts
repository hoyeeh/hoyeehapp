import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Check if current user is a creator
export const useIsCreator = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["is-creator", user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase.rpc('is_creator', {
        _user_id: user.id
      });
      
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user,
  });
};

// Get creator profile for current user
export const useCreatorProfile = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["creator-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('creator_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

// Get creator application status
export const useCreatorApplication = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["creator-application", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('creator_applications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

// Submit creator application
export const useSubmitCreatorApplication = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ description, portfolioUrl }: { description: string; portfolioUrl?: string }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('creator_applications')
        .insert({
          user_id: user.id,
          description,
          portfolio_url: portfolioUrl || null
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-application"] });
      toast.success("Application submitted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit application");
    }
  });
};

// Get creator's content (content table entries created by this creator)
export const useCreatorContent = () => {
  const { data: creatorProfile } = useCreatorProfile();
  
  return useQuery({
    queryKey: ["creator-content", creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile) return [];
      
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('created_by', creatorProfile.user_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!creatorProfile,
  });
};

// Get creator's paid content entries
export const useCreatorPaidContent = () => {
  const { data: creatorProfile } = useCreatorProfile();
  
  return useQuery({
    queryKey: ["creator-paid-content", creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile) return [];
      
      const { data, error } = await supabase
        .from('paid_content')
        .select('*')
        .eq('creator_id', creatorProfile.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!creatorProfile,
  });
};

// Create paid content
export const useCreatePaidContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { content_id: string; creator_id: string; price: number; is_active: boolean }) => {
      const { data: result, error } = await supabase
        .from('paid_content')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-paid-content"] });
    },
  });
};

// Update paid content
export const useUpdatePaidContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, price, is_active }: { id: string; price: number; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('paid_content')
        .update({ price, is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-paid-content"] });
    },
  });
};

// Delete paid content
export const useDeletePaidContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('paid_content')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-paid-content"] });
    },
  });
};

// Get creator's payouts
export const useCreatorPayouts = () => {
  const { data: creatorProfile } = useCreatorProfile();
  
  return useQuery({
    queryKey: ["creator-payouts", creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile) return [];
      
      const { data, error } = await supabase
        .from('creator_payouts')
        .select('*')
        .eq('creator_id', creatorProfile.id)
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!creatorProfile,
  });
};

// Get creator's sales/purchases
export const useCreatorSales = () => {
  const { data: creatorProfile } = useCreatorProfile();
  
  return useQuery({
    queryKey: ["creator-sales", creatorProfile?.id],
    queryFn: async () => {
      if (!creatorProfile) return [];
      
      const { data, error } = await supabase
        .from('content_purchases')
        .select('*, content(*)')
        .eq('creator_id', creatorProfile.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!creatorProfile,
  });
};

// Update creator profile
export const useUpdateCreatorProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      profileId, 
      displayName, 
      bio, 
      avatarUrl,
      coverUrl,
      payoutMethod,
      payoutDetails 
    }: { 
      profileId: string;
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      coverUrl?: string;
      payoutMethod?: string;
      payoutDetails?: any;
    }) => {
      const updates: any = {};
      if (displayName !== undefined) updates.display_name = displayName;
      if (bio !== undefined) updates.bio = bio;
      if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
      if (coverUrl !== undefined) updates.cover_url = coverUrl;
      if (payoutMethod !== undefined) updates.payout_method = payoutMethod;
      if (payoutDetails !== undefined) updates.payout_details = payoutDetails;
      
      const { data, error } = await supabase
        .from('creator_profiles')
        .update(updates)
        .eq('id', profileId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-profile"] });
      toast.success("Profile updated successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
    }
  });
};

// Request payout
export const useRequestPayout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      amount, 
      payoutMethod, 
      payoutDetails 
    }: { 
      amount: number;
      payoutMethod: string;
      payoutDetails: any;
    }) => {
      const { data, error } = await supabase.functions.invoke('creator-payout', {
        body: {
          action: 'request',
          amount,
          payoutMethod,
          payoutDetails
        }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["creator-profile"] });
      toast.success("Payout request submitted!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to request payout");
    }
  });
};

// Get platform settings
export const usePlatformSettings = () => {
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');
      
      if (error) throw error;
      
      return (data || []).reduce((acc, setting) => {
        acc[setting.setting_key] = setting.setting_value;
        return acc;
      }, {} as Record<string, string>);
    },
  });
};

// Check if user has purchased content
export const useHasPurchasedContent = (contentId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["has-purchased", contentId, user?.id],
    queryFn: async () => {
      if (!user || !contentId) return false;
      
      const { data, error } = await supabase.rpc('has_purchased_content', {
        _user_id: user.id,
        _content_id: contentId
      });
      
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!user && !!contentId,
  });
};

// Get paid content info
export const usePaidContentInfo = (contentId: string) => {
  return useQuery({
    queryKey: ["paid-content-info", contentId],
    queryFn: async () => {
      if (!contentId) return null;
      
      const { data, error } = await supabase
        .from('paid_content')
        .select('*, creator_profiles(display_name, avatar_url, is_verified)')
        .eq('content_id', contentId)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!contentId,
  });
};

// Purchase content
export const usePurchaseContent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contentId: string) => {
      const { data, error } = await supabase.functions.invoke('purchase-content', {
        body: {
          action: 'initialize',
          contentId
        }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      // Redirect to payment page
      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to initiate purchase");
    }
  });
};
