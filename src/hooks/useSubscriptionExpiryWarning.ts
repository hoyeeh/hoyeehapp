import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

const WARNING_DAYS = 7;
const CHECK_INTERVAL_MS = 1000 * 60 * 60; // Check every hour

export const useSubscriptionExpiryWarning = () => {
  const { user } = useAuth();
  const hasShownWarning = useRef(false);
  const lastCheckTime = useRef<number>(0);

  useEffect(() => {
    if (!user) {
      hasShownWarning.current = false;
      return;
    }

    const checkSubscriptionExpiry = async () => {
      const now = Date.now();
      
      // Throttle checks to avoid excessive queries
      if (now - lastCheckTime.current < CHECK_INTERVAL_MS && hasShownWarning.current) {
        return;
      }
      lastCheckTime.current = now;

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("is_subscribed, subscription_expiry")
          .eq("id", user.id)
          .single();

        if (error || !profile) return;

        // Only check for subscribed users with an expiry date
        if (!profile.is_subscribed || !profile.subscription_expiry) return;

        const expiryDate = new Date(profile.subscription_expiry);
        const daysUntilExpiry = differenceInDays(expiryDate, new Date());

        // Show warning if expiring within 7 days and haven't shown yet this session
        if (daysUntilExpiry <= WARNING_DAYS && daysUntilExpiry > 0 && !hasShownWarning.current) {
          hasShownWarning.current = true;
          
          toast.warning("Subscription Expiring Soon", {
            description: `Your subscription will expire in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}. Renew now to keep your premium access.`,
            duration: 10000,
            action: {
              label: "Renew",
              onClick: () => {
                window.location.href = "/subscription";
              },
            },
          });
        } else if (daysUntilExpiry <= 0 && !hasShownWarning.current) {
          hasShownWarning.current = true;
          
          toast.error("Subscription Expired", {
            description: "Your subscription has expired. Subscribe again to regain premium access.",
            duration: 10000,
            action: {
              label: "Subscribe",
              onClick: () => {
                window.location.href = "/subscription";
              },
            },
          });
        }
      } catch (error) {
        console.error("Error checking subscription expiry:", error);
      }
    };

    // Check on mount
    checkSubscriptionExpiry();

    // Set up periodic check
    const interval = setInterval(checkSubscriptionExpiry, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user]);
};
