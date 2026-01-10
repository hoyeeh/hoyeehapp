import { supabase } from '@/integrations/supabase/client';
import { throttle } from '../../core/utils/throttle';

export interface AnalyticsEvent {
  type: 'play' | 'pause' | 'seek' | 'complete' | 'error' | 'progress' | 'quality_change';
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface AnalyticsOptions {
  contentId: string;
  episodeId?: string;
  userId?: string;
  profileId?: string;
  isKidsMode?: boolean;
  onProgressSaved?: (progress: number) => void;
}

export interface AnalyticsAdapterInstance {
  // Progress tracking
  updateProgress(currentTime: number, duration: number): void;
  saveProgressImmediately(currentTime: number, duration: number): Promise<void>;
  
  // Event tracking
  trackPlay(): void;
  trackPause(): void;
  trackSeek(fromTime: number, toTime: number): void;
  trackComplete(): void;
  trackError(error: string): void;
  
  // Kids mode tracking
  trackKidsWatchTime(minutes: number): void;
  
  // Cleanup
  destroy(): void;
}

const PROGRESS_SAVE_INTERVAL_MS = 10000; // Save progress every 10 seconds

/**
 * Create an Analytics Adapter for tracking watch progress and events
 */
export function createAnalyticsAdapter(options: AnalyticsOptions): AnalyticsAdapterInstance {
  const { 
    contentId, 
    episodeId, 
    userId,
    profileId,
    isKidsMode = false,
    onProgressSaved,
  } = options;

  let lastSavedProgress = 0;
  let sessionStartTime = Date.now();

  // Throttled progress save
  const throttledSaveProgress = throttle(async (currentTime: number, duration: number) => {
    if (!userId || duration <= 0) return;

    const progress = Math.floor(currentTime);
    
    // Don't save if progress hasn't changed significantly
    if (Math.abs(progress - lastSavedProgress) < 5) return;

    try {
      const { error } = await supabase
        .from('watch_history')
        .upsert({
          user_id: userId,
          content_id: episodeId || contentId,
          profile_id: profileId || null,
          progress,
          last_watched: new Date().toISOString(),
        }, {
          onConflict: 'user_id,content_id',
        });

      if (!error) {
        lastSavedProgress = progress;
        onProgressSaved?.(progress);
      }
    } catch (error) {
      console.error('[AnalyticsAdapter] Failed to save progress:', error);
    }
  }, PROGRESS_SAVE_INTERVAL_MS);

  const adapter: AnalyticsAdapterInstance = {
    updateProgress(currentTime: number, duration: number): void {
      throttledSaveProgress(currentTime, duration);
    },

    async saveProgressImmediately(currentTime: number, duration: number): Promise<void> {
      if (!userId || duration <= 0) return;

      const progress = Math.floor(currentTime);

      try {
        await supabase
          .from('watch_history')
          .upsert({
            user_id: userId,
            content_id: episodeId || contentId,
            profile_id: profileId || null,
            progress,
            last_watched: new Date().toISOString(),
          }, {
            onConflict: 'user_id,content_id',
          });

        lastSavedProgress = progress;
        onProgressSaved?.(progress);
      } catch (error) {
        console.error('[AnalyticsAdapter] Failed to save progress:', error);
      }
    },

    trackPlay(): void {
      // Could log to analytics service
      console.log('[AnalyticsAdapter] Play event', { contentId, episodeId });
    },

    trackPause(): void {
      console.log('[AnalyticsAdapter] Pause event', { contentId, episodeId });
    },

    trackSeek(fromTime: number, toTime: number): void {
      console.log('[AnalyticsAdapter] Seek event', { contentId, fromTime, toTime });
    },

    trackComplete(): void {
      console.log('[AnalyticsAdapter] Complete event', { 
        contentId, 
        episodeId,
        watchDuration: Date.now() - sessionStartTime,
      });
    },

    trackError(error: string): void {
      console.error('[AnalyticsAdapter] Error event', { contentId, error });
    },

    async trackKidsWatchTime(minutes: number): Promise<void> {
      if (!isKidsMode || !profileId) return;

      try {
        // Update kids viewing history
        await supabase
          .from('kids_viewing_history')
          .insert({
            profile_id: profileId,
            content_id: contentId,
            duration_watched_minutes: minutes,
            watched_at: new Date().toISOString(),
          });

        // Update daily time watched
        const today = new Date().toISOString().split('T')[0];
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('time_watched_today_minutes, last_time_reset')
          .eq('id', profileId)
          .single();

        if (profile) {
          let newWatchedMinutes = minutes;
          
          // Reset if last reset was not today
          if (profile.last_time_reset !== today) {
            await supabase
              .from('user_profiles')
              .update({
                time_watched_today_minutes: minutes,
                last_time_reset: today,
              })
              .eq('id', profileId);
          } else {
            await supabase
              .from('user_profiles')
              .update({
                time_watched_today_minutes: (profile.time_watched_today_minutes || 0) + minutes,
              })
              .eq('id', profileId);
          }
        }
      } catch (error) {
        console.error('[AnalyticsAdapter] Failed to track kids watch time:', error);
      }
    },

    destroy(): void {
      throttledSaveProgress.cancel();
    },
  };

  return adapter;
}
