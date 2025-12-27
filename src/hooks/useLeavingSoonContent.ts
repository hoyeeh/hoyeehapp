import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";

export function useLeavingSoonContent(limit = 20) {
  return useQuery({
    queryKey: ['leaving-soon-content', limit],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data, error } = await supabase
        .from('content')
        .select('*')
        .in('lifecycle_status', ['leaving_soon', 'active'])
        .not('expires_at', 'is', null)
        .lte('expires_at', thirtyDaysFromNow.toISOString())
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((item): Content => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        thumbnailUrl: item.thumbnail_url || '',
        videoUrl: item.video_url || '',
        genre: item.genre || '',
        contentType: item.content_type as 'movie' | 'series',
        isPremium: item.is_premium || false,
        duration: item.duration || 0,
        year: item.year || undefined,
        rating: item.rating || undefined,
        contentRating: item.content_rating || undefined,
        createdAt: item.created_at || undefined,
        lifecycleStatus: item.lifecycle_status as Content['lifecycleStatus'],
        expiresAt: item.expires_at || undefined,
        viewsLast30Days: item.views_last_30_days || 0,
      }));
    },
  });
}
