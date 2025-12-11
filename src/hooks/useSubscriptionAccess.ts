import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsSuperAdmin } from '@/hooks/useSuperAdmin';

export const useSubscriptionAccess = () => {
  const { user } = useAuth();
  const { data: isSuperAdmin, isLoading: superAdminLoading } = useIsSuperAdmin();

  // Fetch profile subscription data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('is_subscribed, subscription_expiry')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Super admins always have full access regardless of subscription
  const hasFullAccess = isSuperAdmin === true;
  
  // Check if user has an active subscription
  const hasActiveSubscription = profile?.is_subscribed && 
    (!profile?.subscription_expiry || new Date(profile.subscription_expiry) > new Date());

  // User can access premium content if they're a super admin OR have an active subscription
  const canAccessPremium = hasFullAccess || hasActiveSubscription;

  return {
    hasFullAccess,
    hasActiveSubscription,
    canAccessPremium,
    isLoading: superAdminLoading || profileLoading,
    isSuperAdmin: isSuperAdmin === true,
    subscriptionExpiry: profile?.subscription_expiry,
  };
};
