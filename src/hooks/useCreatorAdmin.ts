import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Get platform settings
export const usePlatformSettings = () => {
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');
      
      if (error) throw error;
      
      // Convert to key-value object
      const settings: Record<string, string> = {};
      data?.forEach(item => {
        settings[item.setting_key] = item.setting_value;
      });
      return settings;
    },
  });
};

// Get all creator applications (admin)
export const useCreatorApplications = (status?: string) => {
  return useQuery({
    queryKey: ["admin-creator-applications", status],
    queryFn: async () => {
      // First get applications
      let query = supabase
        .from('creator_applications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data: applications, error } = await query;
      
      if (error) throw error;
      
      // Then get profiles for each application
      if (applications && applications.length > 0) {
        const userIds = applications.map(app => app.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);
        
        // Merge profiles into applications
        return applications.map(app => ({
          ...app,
          profiles: profiles?.find(p => p.id === app.user_id) || null
        }));
      }
      
      return applications;
    },
  });
};

// Approve creator application
export const useApproveCreatorApplication = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      userId, 
      displayName 
    }: { 
      applicationId: string;
      userId: string;
      displayName: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Update application status
      const { error: updateError } = await supabase
        .from('creator_applications')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', applicationId);
      
      if (updateError) throw updateError;
      
      // Create creator profile
      const { error: profileError } = await supabase
        .from('creator_profiles')
        .insert({
          user_id: userId,
          display_name: displayName
        });
      
      if (profileError) throw profileError;
      
      // Add creator role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'creator'
        });
      
      if (roleError) throw roleError;
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-creator-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
      toast.success("Application approved! Creator profile created.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to approve application");
    }
  });
};

// Reject creator application
export const useRejectCreatorApplication = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      reason 
    }: { 
      applicationId: string;
      reason?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('creator_applications')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', applicationId);
      
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-creator-applications"] });
      toast.success("Application rejected");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reject application");
    }
  });
};

// Get all creators (admin)
export const useAllCreators = () => {
  return useQuery({
    queryKey: ["admin-creators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creator_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

// Get all creator payouts (admin)
export const useAllCreatorPayouts = (status?: string) => {
  return useQuery({
    queryKey: ["admin-creator-payouts", status],
    queryFn: async () => {
      let query = supabase
        .from('creator_payouts')
        .select('*, creator_profiles(display_name, user_id)')
        .order('requested_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });
};

// Process payout (admin)
export const useProcessPayout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payoutId: string) => {
      const { data, error } = await supabase.functions.invoke('creator-payout', {
        body: {
          action: 'process',
          payoutId
        }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-creator-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
      toast.success("Payout processed successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process payout");
    }
  });
};

// Update platform settings (admin)
export const useUpdatePlatformSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      if (!user) throw new Error('Not authenticated');
      
      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      }));
      
      for (const update of updates) {
        const { error } = await supabase
          .from('platform_settings')
          .update({
            setting_value: update.setting_value,
            updated_by: update.updated_by,
            updated_at: update.updated_at
          })
          .eq('setting_key', update.setting_key);
        
        if (error) throw error;
      }
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      toast.success("Settings updated successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update settings");
    }
  });
};

// Update creator profile (admin)
export const useAdminUpdateCreator = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      creatorId, 
      updates 
    }: { 
      creatorId: string;
      updates: {
        is_verified?: boolean;
        is_active?: boolean;
      };
    }) => {
      const { error } = await supabase
        .from('creator_profiles')
        .update(updates)
        .eq('id', creatorId);
      
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-creators"] });
      toast.success("Creator updated successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update creator");
    }
  });
};

// Get all paid content (admin)
export const useAllPaidContent = () => {
  return useQuery({
    queryKey: ["admin-paid-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paid_content')
        .select('*, content(title, thumbnail_url), creator_profiles(display_name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

// Get all content purchases (admin)
export const useAllContentPurchases = () => {
  return useQuery({
    queryKey: ["admin-content-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_purchases')
        .select('*, content(title), creator_profiles(display_name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

// Get creator marketplace stats (admin)
export const useCreatorMarketplaceStats = () => {
  return useQuery({
    queryKey: ["admin-marketplace-stats"],
    queryFn: async () => {
      // Get total creators
      const { count: totalCreators } = await supabase
        .from('creator_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      // Get pending applications
      const { count: pendingApplications } = await supabase
        .from('creator_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      // Get total paid content
      const { count: totalPaidContent } = await supabase
        .from('paid_content')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      // Get total sales
      const { data: salesData } = await supabase
        .from('content_purchases')
        .select('amount, platform_share')
        .eq('status', 'completed');
      
      const totalSales = salesData?.length || 0;
      const totalRevenue = salesData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const platformRevenue = salesData?.reduce((sum, p) => sum + Number(p.platform_share), 0) || 0;
      
      // Get pending payouts
      const { data: pendingPayouts } = await supabase
        .from('creator_payouts')
        .select('amount')
        .eq('status', 'pending');
      
      const pendingPayoutAmount = pendingPayouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      
      return {
        totalCreators: totalCreators || 0,
        pendingApplications: pendingApplications || 0,
        totalPaidContent: totalPaidContent || 0,
        totalSales,
        totalRevenue,
        platformRevenue,
        pendingPayoutCount: pendingPayouts?.length || 0,
        pendingPayoutAmount
      };
    },
  });
};
