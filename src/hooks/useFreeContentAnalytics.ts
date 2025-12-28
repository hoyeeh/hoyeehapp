import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type EventType = 'view' | 'click' | 'play' | 'complete';

interface TrackEventParams {
  contentId: string;
  sectionId?: string;
  eventType: EventType;
  deviceType?: string;
}

// Generate or retrieve session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('free_content_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('free_content_session_id', sessionId);
  }
  return sessionId;
};

// Detect device type
const getDeviceType = (): string => {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
};

export function useFreeContentAnalytics() {
  const { user } = useAuth();

  const trackEvent = useMutation({
    mutationFn: async ({ contentId, sectionId, eventType, deviceType }: TrackEventParams) => {
      const { error } = await supabase
        .from('free_content_analytics')
        .insert({
          user_id: user?.id || null,
          content_id: contentId,
          section_id: sectionId || null,
          event_type: eventType,
          session_id: getSessionId(),
          device_type: deviceType || getDeviceType(),
        });
      
      if (error) throw error;

      // Update conversion tracking if user is logged in
      if (user?.id && eventType === 'play') {
        await updateConversionTracking(user.id, contentId);
      }
    },
  });

  return {
    trackFreeContentView: (contentId: string, sectionId?: string) => 
      trackEvent.mutate({ contentId, sectionId, eventType: 'view' }),
    trackFreeContentClick: (contentId: string, sectionId?: string) => 
      trackEvent.mutate({ contentId, sectionId, eventType: 'click' }),
    trackFreeContentPlay: (contentId: string, sectionId?: string) => 
      trackEvent.mutate({ contentId, sectionId, eventType: 'play' }),
    trackFreeContentComplete: (contentId: string, sectionId?: string) => 
      trackEvent.mutate({ contentId, sectionId, eventType: 'complete' }),
  };
}

async function updateConversionTracking(userId: string, contentId: string) {
  // Get existing tracking record
  const { data: existing } = await supabase
    .from('premium_conversion_tracking')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    // Update existing record
    const viewedContent = Array.isArray(existing.free_content_viewed) 
      ? existing.free_content_viewed 
      : [];
    
    if (!viewedContent.includes(contentId)) {
      viewedContent.push(contentId);
      await supabase
        .from('premium_conversion_tracking')
        .update({
          free_content_viewed: viewedContent,
          free_content_count: viewedContent.length,
        })
        .eq('user_id', userId);
    }
  } else {
    // Create new record
    await supabase
      .from('premium_conversion_tracking')
      .insert({
        user_id: userId,
        free_content_viewed: [contentId],
        free_content_count: 1,
        first_free_content_at: new Date().toISOString(),
      });
  }
}

// Hook to track when a user subscribes (call this after successful subscription)
export function useTrackPremiumConversion() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (subscriptionPlan: string) => {
      if (!user?.id) return;

      const { data: tracking } = await supabase
        .from('premium_conversion_tracking')
        .select('first_free_content_at')
        .eq('user_id', user.id)
        .single();

      const daysToConvert = tracking?.first_free_content_at
        ? Math.floor((Date.now() - new Date(tracking.first_free_content_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      await supabase
        .from('premium_conversion_tracking')
        .upsert({
          user_id: user.id,
          subscription_started_at: new Date().toISOString(),
          subscription_plan: subscriptionPlan,
          days_to_convert: daysToConvert,
        }, { onConflict: 'user_id' });
    },
  });
}

// Admin hook to get analytics data
export function useFreeContentAnalyticsData(dateRange?: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ['free-content-analytics', dateRange?.start, dateRange?.end],
    queryFn: async () => {
      let query = supabase
        .from('free_content_analytics')
        .select(`
          id,
          content_id,
          section_id,
          event_type,
          device_type,
          created_at,
          content:content_id(title, thumbnail_url, content_type),
          home_sections:section_id(title)
        `)
        .order('created_at', { ascending: false });

      if (dateRange?.start) {
        query = query.gte('created_at', dateRange.start.toISOString());
      }
      if (dateRange?.end) {
        query = query.lte('created_at', dateRange.end.toISOString());
      }

      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data;
    },
  });
}

// Admin hook to get conversion metrics
export function useConversionMetrics() {
  return useQuery({
    queryKey: ['conversion-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premium_conversion_tracking')
        .select('*')
        .not('subscription_started_at', 'is', null);

      if (error) throw error;

      const totalConversions = data?.length || 0;
      const avgDaysToConvert = data?.reduce((acc, curr) => acc + (curr.days_to_convert || 0), 0) / totalConversions || 0;
      const avgFreeContentViewed = data?.reduce((acc, curr) => acc + (curr.free_content_count || 0), 0) / totalConversions || 0;

      return {
        totalConversions,
        avgDaysToConvert: Math.round(avgDaysToConvert * 10) / 10,
        avgFreeContentViewed: Math.round(avgFreeContentViewed * 10) / 10,
        conversions: data,
      };
    },
  });
}
