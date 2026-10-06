import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook to subscribe to realtime updates for home sections.
 * When admin makes changes to home_sections, this automatically
 * invalidates the cache and triggers a refresh.
 */
export function useRealtimeHomeSections() {
  const queryClient = useQueryClient();

  const invalidateHomeSections = useCallback(() => {
    console.log('[RealtimeHomeSections] Invalidating home section caches...');
    
    // Invalidate all home section related queries
    queryClient.invalidateQueries({ queryKey: ['home-sections-display'] });
    queryClient.invalidateQueries({ queryKey: ['mobile-home-sections'] });
    queryClient.invalidateQueries({ queryKey: ['section-content-display'] });
    queryClient.invalidateQueries({ queryKey: ['mobile-section-content'] });
    queryClient.invalidateQueries({ queryKey: ['kids-home-sections'] });
    queryClient.invalidateQueries({ queryKey: ['kids-section-content'] });
    queryClient.invalidateQueries({ queryKey: ['kids-content-desktop'] });
    queryClient.invalidateQueries({ queryKey: ['kids-content-mobile'] });
    queryClient.invalidateQueries({ queryKey: ['content'] });
    queryClient.invalidateQueries({ queryKey: ['mobile-trending'] });
    queryClient.invalidateQueries({ queryKey: ['mobile-new-releases'] });
    queryClient.invalidateQueries({ queryKey: ['mobile-top-10'] });
    queryClient.invalidateQueries({ queryKey: ['leaving-soon-content'] });
    queryClient.invalidateQueries({ queryKey: ['trending-content'] });
    queryClient.invalidateQueries({ queryKey: ['recently-added-home'] });
    queryClient.invalidateQueries({ queryKey: ['top-10-display'] });
    // New personalized section caches
    queryClient.invalidateQueries({ queryKey: ['continue-watching-enhanced'] });
    queryClient.invalidateQueries({ queryKey: ['recently-watched-completed'] });
    queryClient.invalidateQueries({ queryKey: ['because-you-watched'] });
    queryClient.invalidateQueries({ queryKey: ['mobile-because-you-watched'] });
    queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
    queryClient.invalidateQueries({ queryKey: ['coming-soon'] });
  }, [queryClient]);

  useEffect(() => {
    console.log('[RealtimeHomeSections] Setting up realtime subscription...');

    // Subscribe to home_sections table changes
    const homeSectionsChannel = supabase
      .channel('home-sections-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'home_sections',
        },
        (payload) => {
          console.log('[RealtimeHomeSections] home_sections changed:', payload.eventType);
          invalidateHomeSections();
        }
      )
      .subscribe((status) => {
        console.log('[RealtimeHomeSections] Subscription status:', status);
      });

    // Subscribe to section_content table changes (for curated sections)
    const sectionContentChannel = supabase
      .channel('section-content-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'section_content',
        },
        (payload) => {
          console.log('[RealtimeHomeSections] section_content changed:', payload.eventType);
          invalidateHomeSections();
        }
      )
      .subscribe();

    // Subscribe to content table changes (for new releases, trending, etc.)
    const contentChannel = supabase
      .channel('content-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content',
        },
        (payload) => {
          console.log('[RealtimeHomeSections] content changed:', payload.eventType);
          // Debounce content updates to avoid excessive refreshes
          setTimeout(() => invalidateHomeSections(), 500);
        }
      )
      .subscribe();

    // Subscribe to top_10 table changes
    const top10Channel = supabase
      .channel('top10-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'top_10',
        },
        (payload) => {
          console.log('[RealtimeHomeSections] top_10 changed:', payload.eventType);
          invalidateHomeSections();
        }
      )
      .subscribe();

    // Subscribe to hero_banners table changes
    const heroBannersChannel = supabase
      .channel('hero-banners-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hero_banners',
        },
        (payload) => {
          console.log('[RealtimeHomeSections] hero_banners changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['hero-banners'] });
          queryClient.invalidateQueries({ queryKey: ['mobile-hero-banners'] });
        }
      )
      .subscribe();

    const homepageManagementChannel = supabase
      .channel('homepage-management-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homepage_layout_state' }, () => {
        queryClient.invalidateQueries({ queryKey: ['homepage-layout-state'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homepage_ai_suggestions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['homepage-ai-suggestions'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_homepage_change_log' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ai-homepage-change-log'] });
      })
      .subscribe();

    return () => {
      console.log('[RealtimeHomeSections] Cleaning up subscriptions...');
      supabase.removeChannel(homeSectionsChannel);
      supabase.removeChannel(sectionContentChannel);
      supabase.removeChannel(contentChannel);
      supabase.removeChannel(top10Channel);
      supabase.removeChannel(heroBannersChannel);
      supabase.removeChannel(homepageManagementChannel);
    };
  }, [invalidateHomeSections, queryClient]);

  return { invalidateHomeSections };
}
