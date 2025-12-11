import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useDownloadExpiryNotifications = () => {
  const { user } = useAuth();

  const checkExpiringDownloads = useCallback(async () => {
    if (!user || !('Notification' in window)) return;

    try {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Fetch download licenses that are expiring soon
      const { data: licenses, error } = await supabase
        .from('download_licenses')
        .select(`
          id,
          expires_at,
          content:content_id (
            id,
            title,
            thumbnail_url
          ),
          episode:episode_id (
            id,
            title
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .lt('expires_at', threeDaysFromNow.toISOString())
        .gt('expires_at', now.toISOString());

      if (error) {
        console.error('Error fetching expiring downloads:', error);
        return;
      }

      if (!licenses || licenses.length === 0) return;

      // Check if we've already notified for these downloads today
      const notifiedKey = `download_expiry_notified_${user.id}_${now.toDateString()}`;
      const alreadyNotified = localStorage.getItem(notifiedKey);
      
      if (alreadyNotified) {
        const notifiedIds = JSON.parse(alreadyNotified);
        const newLicenses = licenses.filter(l => !notifiedIds.includes(l.id));
        if (newLicenses.length === 0) return;
      }

      // Request notification permission if not granted
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if (Notification.permission !== 'granted') return;

      // Group by urgency
      const urgent = licenses.filter(l => new Date(l.expires_at) <= oneDayFromNow);
      const expiringSoon = licenses.filter(l => 
        new Date(l.expires_at) > oneDayFromNow && 
        new Date(l.expires_at) <= threeDaysFromNow
      );

      // Send notifications
      if (urgent.length > 0) {
        const title = urgent.length === 1
          ? `Download expires in less than 24 hours!`
          : `${urgent.length} downloads expire in less than 24 hours!`;
        
        const contentTitles = urgent.map(l => {
          const content = l.content as any;
          const episode = l.episode as any;
          return episode?.title || content?.title || 'Unknown content';
        }).slice(0, 3);

        const body = contentTitles.join(', ') + (urgent.length > 3 ? ` and ${urgent.length - 3} more` : '');

        new Notification(title, {
          body,
          icon: '/favicon.png',
          tag: 'download-expiry-urgent',
          requireInteraction: true,
        });
      }

      if (expiringSoon.length > 0) {
        const title = expiringSoon.length === 1
          ? `Download expires in 3 days`
          : `${expiringSoon.length} downloads expire in 3 days`;
        
        const contentTitles = expiringSoon.map(l => {
          const content = l.content as any;
          const episode = l.episode as any;
          return episode?.title || content?.title || 'Unknown content';
        }).slice(0, 3);

        const body = contentTitles.join(', ') + (expiringSoon.length > 3 ? ` and ${expiringSoon.length - 3} more` : '');

        new Notification(title, {
          body,
          icon: '/favicon.png',
          tag: 'download-expiry-soon',
        });
      }

      // Mark as notified for today
      const notifiedIds = licenses.map(l => l.id);
      localStorage.setItem(notifiedKey, JSON.stringify(notifiedIds));

      // Also send push notification via edge function for subscribed users
      try {
        for (const license of urgent) {
          const content = license.content as any;
          const episode = license.episode as any;
          const contentTitle = episode?.title || content?.title || 'Your download';
          
          await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: user.id,
              title: 'Download Expiring Soon!',
              body: `"${contentTitle}" expires in less than 24 hours. Watch it before it's gone!`,
              type: 'download_expiry',
            },
          });
        }
      } catch (pushError) {
        console.error('Error sending push notification:', pushError);
      }

    } catch (error) {
      console.error('Error checking expiring downloads:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Check immediately on mount
    checkExpiringDownloads();

    // Check every 6 hours
    const interval = setInterval(checkExpiringDownloads, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, checkExpiringDownloads]);

  return { checkExpiringDownloads };
};