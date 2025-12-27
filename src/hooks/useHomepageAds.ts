import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";

export interface HomepageAd {
  id: string;
  title: string;
  subtitle: string | null;
  status: 'draft' | 'active' | 'paused' | 'archived';
  priority: number;
  weight: number;
  video_url: string | null;
  video_type: 'mp4' | 'hls' | null;
  poster_url: string;
  cta_label: string | null;
  cta_url: string | null;
  cta_internal_route: string | null;
  contexts: { main?: boolean; kids?: boolean; tv?: boolean };
  targeting: { country?: string[]; device?: string[] } | null;
  kids_safe: boolean;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  // A/B testing and subscription targeting
  ab_test_id: string | null;
  variant: string;
  subscription_target: 'all' | 'free' | 'premium';
}

export interface HomepageAdEvent {
  id: string;
  ad_id: string;
  session_id: string;
  user_id: string | null;
  event_type: 'impression' | 'click' | 'play' | 'pause' | 'error' | 'mute' | 'unmute';
  device_type: string | null;
  app_context: 'main' | 'kids' | 'tv' | null;
  created_at: string;
  variant: string | null;
  user_is_subscribed: boolean | null;
}

export interface AdAnalytics {
  date: string;
  impressions: number;
  clicks: number;
  plays: number;
  errors: number;
  ctr: number;
}

export interface ABTestResults {
  variant: string;
  impressions: number;
  clicks: number;
  plays: number;
  ctr: number;
  playRate: number;
}

// Generate or get session ID for analytics
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('ad_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('ad_session_id', sessionId);
  }
  return sessionId;
};

// Get device type
const getDeviceType = (): string => {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return 'mobile';
  return 'desktop';
};

// Weighted random selection
const weightedRandomSelect = (ads: HomepageAd[]): HomepageAd[] => {
  // Sort by priority first (higher priority first)
  const sorted = [...ads].sort((a, b) => b.priority - a.priority);
  
  // Group by priority
  const groups: Map<number, HomepageAd[]> = new Map();
  sorted.forEach(ad => {
    const group = groups.get(ad.priority) || [];
    group.push(ad);
    groups.set(ad.priority, group);
  });
  
  // Within each priority group, shuffle based on weight
  const result: HomepageAd[] = [];
  groups.forEach(group => {
    const shuffled = [...group];
    // Fisher-Yates shuffle with weight bias
    for (let i = shuffled.length - 1; i > 0; i--) {
      const totalWeight = shuffled.slice(0, i + 1).reduce((sum, ad) => sum + ad.weight, 0);
      let random = Math.random() * totalWeight;
      let j = 0;
      while (random > shuffled[j].weight && j < i) {
        random -= shuffled[j].weight;
        j++;
      }
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    result.push(...shuffled);
  });
  
  return result;
};

export function useActiveHomepageAds(context: 'main' | 'kids' | 'tv' = 'main') {
  const { data: profile } = useProfile();
  const isSubscribed = profile?.is_subscribed ?? false;
  
  return useQuery({
    queryKey: ['homepage-ads', 'active', context, isSubscribed],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('homepage_ads')
        .select('*')
        .eq('status', 'active')
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gt.${now}`);
      
      if (error) throw error;
      
      // Filter by context, kids_safe, and subscription targeting
      const filtered = (data as HomepageAd[]).filter(ad => {
        const contexts = ad.contexts || { main: true, kids: false, tv: false };
        if (!contexts[context]) return false;
        if (context === 'kids' && !ad.kids_safe) return false;
        
        // Filter by subscription status
        const target = ad.subscription_target || 'all';
        if (target === 'premium' && !isSubscribed) return false;
        if (target === 'free' && isSubscribed) return false;
        
        return true;
      });
      
      // For A/B testing: select one variant per ab_test_id
      const abTestGroups = new Map<string, HomepageAd[]>();
      const nonAbTestAds: HomepageAd[] = [];
      
      filtered.forEach(ad => {
        if (ad.ab_test_id) {
          const group = abTestGroups.get(ad.ab_test_id) || [];
          group.push(ad);
          abTestGroups.set(ad.ab_test_id, group);
        } else {
          nonAbTestAds.push(ad);
        }
      });
      
      // Select one variant per A/B test using weighted random
      const selectedFromTests: HomepageAd[] = [];
      abTestGroups.forEach(group => {
        const totalWeight = group.reduce((sum, ad) => sum + ad.weight, 0);
        let random = Math.random() * totalWeight;
        for (const ad of group) {
          random -= ad.weight;
          if (random <= 0) {
            selectedFromTests.push(ad);
            break;
          }
        }
        // Fallback to first if none selected
        if (selectedFromTests.length === 0 && group.length > 0) {
          selectedFromTests.push(group[0]);
        }
      });
      
      const finalAds = [...nonAbTestAds, ...selectedFromTests];
      
      // Apply weighted random selection for ordering
      return weightedRandomSelect(finalAds);
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });
}

export function useAllHomepageAds() {
  return useQuery({
    queryKey: ['homepage-ads', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homepage_ads')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as HomepageAd[];
    },
  });
}

export function useHomepageAdStats(adId: string) {
  return useQuery({
    queryKey: ['homepage-ads', 'stats', adId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homepage_ads_events')
        .select('event_type, variant, created_at')
        .eq('ad_id', adId);
      
      if (error) throw error;
      
      const stats = {
        impressions: 0,
        clicks: 0,
        plays: 0,
        errors: 0,
      };
      
      data?.forEach(event => {
        if (event.event_type === 'impression') stats.impressions++;
        if (event.event_type === 'click') stats.clicks++;
        if (event.event_type === 'play') stats.plays++;
        if (event.event_type === 'error') stats.errors++;
      });
      
      return stats;
    },
  });
}

// Get time-series analytics for an ad
export function useHomepageAdAnalytics(adId: string, days: number = 30) {
  return useQuery({
    queryKey: ['homepage-ads', 'analytics', adId, days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await supabase
        .from('homepage_ads_events')
        .select('event_type, created_at')
        .eq('ad_id', adId)
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      
      // Group by date
      const dailyStats = new Map<string, { impressions: number; clicks: number; plays: number; errors: number }>();
      
      data?.forEach(event => {
        const date = new Date(event.created_at).toISOString().split('T')[0];
        const existing = dailyStats.get(date) || { impressions: 0, clicks: 0, plays: 0, errors: 0 };
        
        if (event.event_type === 'impression') existing.impressions++;
        if (event.event_type === 'click') existing.clicks++;
        if (event.event_type === 'play') existing.plays++;
        if (event.event_type === 'error') existing.errors++;
        
        dailyStats.set(date, existing);
      });
      
      // Convert to array and calculate CTR
      const analytics: AdAnalytics[] = [];
      dailyStats.forEach((stats, date) => {
        analytics.push({
          date,
          ...stats,
          ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
        });
      });
      
      return analytics.sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

// Get A/B test results for a group of ads
export function useABTestResults(abTestId: string | null) {
  return useQuery({
    queryKey: ['homepage-ads', 'ab-test', abTestId],
    enabled: !!abTestId,
    queryFn: async () => {
      // Get all ads in this A/B test
      const { data: ads, error: adsError } = await supabase
        .from('homepage_ads')
        .select('id, variant')
        .eq('ab_test_id', abTestId);
      
      if (adsError) throw adsError;
      if (!ads?.length) return [];
      
      // Get events for all ads
      const adIds = ads.map(a => a.id);
      const { data: events, error: eventsError } = await supabase
        .from('homepage_ads_events')
        .select('ad_id, event_type, variant')
        .in('ad_id', adIds);
      
      if (eventsError) throw eventsError;
      
      // Group by variant
      const variantStats = new Map<string, { impressions: number; clicks: number; plays: number }>();
      
      ads.forEach(ad => {
        if (!variantStats.has(ad.variant)) {
          variantStats.set(ad.variant, { impressions: 0, clicks: 0, plays: 0 });
        }
      });
      
      events?.forEach(event => {
        const ad = ads.find(a => a.id === event.ad_id);
        if (!ad) return;
        
        const stats = variantStats.get(ad.variant);
        if (!stats) return;
        
        if (event.event_type === 'impression') stats.impressions++;
        if (event.event_type === 'click') stats.clicks++;
        if (event.event_type === 'play') stats.plays++;
      });
      
      // Convert to results
      const results: ABTestResults[] = [];
      variantStats.forEach((stats, variant) => {
        results.push({
          variant,
          ...stats,
          ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
          playRate: stats.impressions > 0 ? (stats.plays / stats.impressions) * 100 : 0,
        });
      });
      
      return results.sort((a, b) => a.variant.localeCompare(b.variant));
    },
  });
}

// Get all A/B tests
export function useABTests() {
  return useQuery({
    queryKey: ['homepage-ads', 'ab-tests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homepage_ads')
        .select('ab_test_id, variant, title, status')
        .not('ab_test_id', 'is', null);
      
      if (error) throw error;
      
      // Group by ab_test_id
      const tests = new Map<string, { id: string; variants: { variant: string; title: string; status: string }[] }>();
      
      data?.forEach(ad => {
        if (!ad.ab_test_id) return;
        const existing = tests.get(ad.ab_test_id) || { id: ad.ab_test_id, variants: [] };
        existing.variants.push({ variant: ad.variant, title: ad.title, status: ad.status });
        tests.set(ad.ab_test_id, existing);
      });
      
      return Array.from(tests.values());
    },
  });
}

export function useCreateHomepageAd() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ad: Omit<HomepageAd, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('homepage_ads')
        .insert(ad)
        .select()
        .single();
      
      if (error) throw error;
      return data as HomepageAd;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage-ads'] });
    },
  });
}

export function useUpdateHomepageAd() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HomepageAd> & { id: string }) => {
      const { data, error } = await supabase
        .from('homepage_ads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as HomepageAd;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage-ads'] });
    },
  });
}

export function useDeleteHomepageAd() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('homepage_ads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage-ads'] });
    },
  });
}

export function useTrackAdEvent() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  
  return useMutation({
    mutationFn: async ({
      adId,
      eventType,
      appContext = 'main',
      variant,
    }: {
      adId: string;
      eventType: HomepageAdEvent['event_type'];
      appContext?: 'main' | 'kids' | 'tv';
      variant?: string;
    }) => {
      const { error } = await supabase
        .from('homepage_ads_events')
        .insert({
          ad_id: adId,
          session_id: getSessionId(),
          user_id: user?.id || null,
          event_type: eventType,
          device_type: getDeviceType(),
          app_context: appContext,
          variant: variant || null,
          user_is_subscribed: profile?.is_subscribed ?? null,
        });
      
      if (error) throw error;
    },
  });
}
