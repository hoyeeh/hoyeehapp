import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type FunnelEvent = 
  | 'paid_content_view'      // User views a paid content card
  | 'paid_content_click'     // User clicks on paid content card
  | 'purchase_modal_open'    // Purchase modal opens
  | 'purchase_init'          // User initiates purchase
  | 'purchase_verified'      // Purchase successfully verified
  | 'purchase_failed';       // Purchase failed

interface AnalyticsPayload {
  content_id?: string;
  paid_content_id?: string;
  creator_id?: string;
  price?: number;
  currency?: string;
  payment_method?: string;
  error_message?: string;
}

/**
 * Hook for tracking paid content funnel analytics
 */
export function usePaidContentAnalytics() {
  const { user } = useAuth();

  const trackEvent = useCallback(async (
    event: FunnelEvent,
    payload: AnalyticsPayload = {}
  ) => {
    try {
      // Log to console in development
      console.log(`[Analytics] ${event}`, {
        user_id: user?.id,
        timestamp: new Date().toISOString(),
        ...payload
      });

      // Store in local analytics (we could add a table later)
      const analyticsData = {
        event,
        user_id: user?.id || null,
        timestamp: new Date().toISOString(),
        ...payload
      };

      // Store in sessionStorage for debugging
      const existingEvents = JSON.parse(sessionStorage.getItem('paid_content_analytics') || '[]');
      existingEvents.push(analyticsData);
      sessionStorage.setItem('paid_content_analytics', JSON.stringify(existingEvents.slice(-100)));

      // Future: Could send to a dedicated analytics table
      // await supabase.from('paid_content_analytics').insert(analyticsData);

    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }, [user?.id]);

  const trackView = useCallback((payload: AnalyticsPayload) => {
    trackEvent('paid_content_view', payload);
  }, [trackEvent]);

  const trackClick = useCallback((payload: AnalyticsPayload) => {
    trackEvent('paid_content_click', payload);
  }, [trackEvent]);

  const trackModalOpen = useCallback((payload: AnalyticsPayload) => {
    trackEvent('purchase_modal_open', payload);
  }, [trackEvent]);

  const trackPurchaseInit = useCallback((payload: AnalyticsPayload) => {
    trackEvent('purchase_init', payload);
  }, [trackEvent]);

  const trackPurchaseVerified = useCallback((payload: AnalyticsPayload) => {
    trackEvent('purchase_verified', payload);
  }, [trackEvent]);

  const trackPurchaseFailed = useCallback((payload: AnalyticsPayload) => {
    trackEvent('purchase_failed', payload);
  }, [trackEvent]);

  return {
    trackEvent,
    trackView,
    trackClick,
    trackModalOpen,
    trackPurchaseInit,
    trackPurchaseVerified,
    trackPurchaseFailed
  };
}
