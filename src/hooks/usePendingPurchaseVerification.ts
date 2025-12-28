import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Hook that runs on app launch to verify any pending purchases
 * This handles cases where users close the tab during payment
 */
export function usePendingPurchaseVerification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!user || hasChecked.current) return;
    hasChecked.current = true;

    const verifyPendingPurchases = async () => {
      try {
        // Get all pending purchases for this user
        const { data: pendingPurchases, error } = await supabase
          .from('content_purchases')
          .select('id, payment_reference, paid_content_id, content_id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error || !pendingPurchases || pendingPurchases.length === 0) {
          return;
        }

        console.log(`Found ${pendingPurchases.length} pending purchases to verify`);

        let verifiedCount = 0;

        // Try to verify each pending purchase
        for (const purchase of pendingPurchases) {
          try {
            const { data, error: verifyError } = await supabase.functions.invoke('purchase-content', {
              body: {
                action: 'verify',
                txRef: purchase.payment_reference
              }
            });

            if (!verifyError && data?.success) {
              verifiedCount++;
              console.log(`Verified purchase: ${purchase.payment_reference}`);
            }
          } catch (e) {
            // Silently fail - payment might not be complete yet
            console.log(`Could not verify purchase ${purchase.payment_reference}`);
          }
        }

        if (verifiedCount > 0) {
          // Invalidate queries to refresh UI
          queryClient.invalidateQueries({ queryKey: ['user-purchases'] });
          queryClient.invalidateQueries({ queryKey: ['has-purchased'] });
          queryClient.invalidateQueries({ queryKey: ['paid-content'] });
          
          toast.success(`${verifiedCount} purchase${verifiedCount > 1 ? 's' : ''} unlocked!`, {
            description: "Your content is now available to watch"
          });
        }
      } catch (error) {
        console.error('Error verifying pending purchases:', error);
      }
    };

    // Run after a short delay to not block initial render
    const timeout = setTimeout(verifyPendingPurchases, 2000);
    return () => clearTimeout(timeout);
  }, [user, queryClient]);
}

/**
 * Hook to manually restore/refresh purchases
 */
export function useRestorePurchases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const restorePurchases = async () => {
    if (!user) {
      toast.error("Please sign in to restore purchases");
      return { restored: 0 };
    }

    try {
      // Get all pending purchases
      const { data: pendingPurchases, error } = await supabase
        .from('content_purchases')
        .select('id, payment_reference')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;

      let verifiedCount = 0;

      if (pendingPurchases && pendingPurchases.length > 0) {
        for (const purchase of pendingPurchases) {
          try {
            const { data, error: verifyError } = await supabase.functions.invoke('purchase-content', {
              body: {
                action: 'verify',
                txRef: purchase.payment_reference
              }
            });

            if (!verifyError && data?.success) {
              verifiedCount++;
            }
          } catch (e) {
            // Continue with next
          }
        }
      }

      // Always refresh queries
      await queryClient.invalidateQueries({ queryKey: ['user-purchases'] });
      await queryClient.invalidateQueries({ queryKey: ['has-purchased'] });
      await queryClient.invalidateQueries({ queryKey: ['paid-content'] });

      return { restored: verifiedCount };
    } catch (error) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
  };

  return { restorePurchases };
}
