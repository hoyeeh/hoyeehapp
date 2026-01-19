import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsSuperAdmin } from '@/hooks/useSuperAdmin';
import { useIsAdmin } from '@/hooks/useAdmin';
import { useState, useEffect } from 'react';

// Key for persisting impersonation mode
const IMPERSONATION_KEY = 'admin_impersonation_mode';

export const useSubscriptionAccess = () => {
  const { user } = useAuth();
  const { data: isSuperAdmin, isLoading: superAdminLoading } = useIsSuperAdmin();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  
  // Impersonation mode state - admins can toggle this to test as regular users
  const [isImpersonating, setIsImpersonating] = useState(() => {
    return localStorage.getItem(IMPERSONATION_KEY) === 'true';
  });

  // Persist impersonation state
  useEffect(() => {
    localStorage.setItem(IMPERSONATION_KEY, isImpersonating.toString());
  }, [isImpersonating]);

  // Fetch profile subscription data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Use profiles_safe view to avoid exposing sensitive fields
      const { data, error } = await supabase
        .from('profiles_safe')
        .select('is_subscribed, subscription_expiry')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check if user is admin or super admin
  const isAdminUser = isSuperAdmin === true || isAdmin === true;
  
  // Admins and super admins always have full access unless impersonating
  const hasFullAccess = isAdminUser && !isImpersonating;
  
  // Check if user has an active subscription
  const hasActiveSubscription = profile?.is_subscribed && 
    (!profile?.subscription_expiry || new Date(profile.subscription_expiry) > new Date());

  // User can access premium content if they're an admin/super admin (not impersonating) OR have an active subscription
  const canAccessPremium = hasFullAccess || hasActiveSubscription;

  // Toggle impersonation mode (only works for admins)
  const toggleImpersonation = () => {
    if (isAdminUser) {
      setIsImpersonating(prev => !prev);
    }
  };

  return {
    hasFullAccess,
    hasActiveSubscription,
    canAccessPremium,
    isLoading: superAdminLoading || adminLoading || profileLoading,
    isSuperAdmin: isSuperAdmin === true,
    isAdmin: isAdmin === true,
    isAdminUser,
    isImpersonating,
    toggleImpersonation,
    subscriptionExpiry: profile?.subscription_expiry,
  };
};
