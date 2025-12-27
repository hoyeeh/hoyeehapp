import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  return useQuery({
    queryKey: ['homepage-ads', 'active', context],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('homepage_ads')
        .select('*')
        .eq('status', 'active')
        .or(`start_at.is.null,start_at.lte.${now}`)
        .or(`end_at.is.null,end_at.gt.${now}`);
      
      if (error) throw error;
      
      // Filter by context and kids_safe
      const filtered = (data as HomepageAd[]).filter(ad => {
        const contexts = ad.contexts || { main: true, kids: false, tv: false };
        if (!contexts[context]) return false;
        if (context === 'kids' && !ad.kids_safe) return false;
        return true;
      });
      
      // Apply weighted random selection
      return weightedRandomSelect(filtered);
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
        .select('event_type')
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
  
  return useMutation({
    mutationFn: async ({
      adId,
      eventType,
      appContext = 'main',
    }: {
      adId: string;
      eventType: HomepageAdEvent['event_type'];
      appContext?: 'main' | 'kids' | 'tv';
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
        });
      
      if (error) throw error;
    },
  });
}
