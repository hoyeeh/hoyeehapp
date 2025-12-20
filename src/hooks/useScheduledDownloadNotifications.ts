import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface DownloadCompletionNotification {
  id: string;
  title: string;
  episodeTitle?: string;
  thumbnailUrl?: string;
  completedAt: number;
  notified: boolean;
}

const NOTIFICATIONS_KEY = 'hoyeeh-download-notifications';
const NOTIFICATION_PERMISSION_KEY = 'hoyeeh-download-notification-permission';

export function useScheduledDownloadNotifications() {
  const notifiedRef = useRef<Set<string>>(new Set());

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      localStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      localStorage.setItem(NOTIFICATION_PERMISSION_KEY, permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, []);

  // Check if notifications are enabled
  const isNotificationsEnabled = useCallback(() => {
    return Notification.permission === 'granted';
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((
    title: string,
    options?: NotificationOptions
  ) => {
    if (!isNotificationsEnabled()) return;

    try {
      const notification = new Notification(title, {
        icon: '/pwa-icon-192.png',
        badge: '/pwa-icon-192.png',
        tag: 'download-complete',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }, [isNotificationsEnabled]);

  // Notify download completion
  const notifyDownloadComplete = useCallback((
    downloadId: string,
    title: string,
    episodeTitle?: string,
    showBrowser = true
  ) => {
    // Prevent duplicate notifications
    if (notifiedRef.current.has(downloadId)) return;
    notifiedRef.current.add(downloadId);

    const displayTitle = episodeTitle || title;

    // Show in-app toast
    toast.success(`Download complete: ${displayTitle}`, {
      description: episodeTitle ? title : undefined,
      action: {
        label: 'Watch Now',
        onClick: () => {
          window.dispatchEvent(new CustomEvent('play-downloaded-content', {
            detail: { downloadId }
          }));
        },
      },
      duration: 5000,
    });

    // Show browser notification if app is in background
    if (showBrowser && document.hidden) {
      showBrowserNotification(`Download Complete`, {
        body: displayTitle,
        data: { downloadId },
      });
    }

    // Save to notifications log
    saveNotification({
      id: downloadId,
      title,
      episodeTitle,
      completedAt: Date.now(),
      notified: true,
    });
  }, [showBrowserNotification]);

  // Notify scheduled download started
  const notifyScheduledDownloadStarted = useCallback((
    title: string,
    episodeTitle?: string,
    reason?: string
  ) => {
    const displayTitle = episodeTitle || title;
    
    toast.info(`Starting scheduled download: ${displayTitle}`, {
      description: reason || 'Conditions met',
      duration: 3000,
    });

    if (document.hidden) {
      showBrowserNotification('Download Started', {
        body: `${displayTitle}${reason ? ` - ${reason}` : ''}`,
      });
    }
  }, [showBrowserNotification]);

  // Notify download failed
  const notifyDownloadFailed = useCallback((
    title: string,
    episodeTitle?: string,
    error?: string
  ) => {
    const displayTitle = episodeTitle || title;

    toast.error(`Download failed: ${displayTitle}`, {
      description: error || 'Please try again',
      action: {
        label: 'Retry',
        onClick: () => {
          window.dispatchEvent(new CustomEvent('retry-failed-download', {
            detail: { title, episodeTitle }
          }));
        },
      },
      duration: 8000,
    });

    if (document.hidden) {
      showBrowserNotification('Download Failed', {
        body: displayTitle,
      });
    }
  }, [showBrowserNotification]);

  // Notify batch download progress
  const notifyBatchProgress = useCallback((
    completed: number,
    total: number,
    currentTitle: string
  ) => {
    if (completed === total) {
      toast.success(`All ${total} downloads complete!`, {
        duration: 5000,
      });
      
      if (document.hidden) {
        showBrowserNotification('Downloads Complete', {
          body: `All ${total} items downloaded successfully`,
        });
      }
    }
  }, [showBrowserNotification]);

  // Save notification to storage
  const saveNotification = useCallback((notification: DownloadCompletionNotification) => {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_KEY);
      const notifications: DownloadCompletionNotification[] = saved ? JSON.parse(saved) : [];
      
      // Keep last 50 notifications
      notifications.unshift(notification);
      if (notifications.length > 50) {
        notifications.pop();
      }
      
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Failed to save notification:', error);
    }
  }, []);

  // Get recent notifications
  const getRecentNotifications = useCallback((): DownloadCompletionNotification[] => {
    try {
      const saved = localStorage.getItem(NOTIFICATIONS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    localStorage.removeItem(NOTIFICATIONS_KEY);
    notifiedRef.current.clear();
  }, []);

  // Listen for service worker messages about background downloads
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};

      switch (type) {
        case 'BACKGROUND_DOWNLOAD_COMPLETE':
          notifyDownloadComplete(
            payload.downloadId,
            payload.title,
            payload.episodeTitle,
            true
          );
          break;

        case 'BACKGROUND_DOWNLOAD_FAILED':
          notifyDownloadFailed(
            payload.title,
            payload.episodeTitle,
            payload.error
          );
          break;

        case 'SCHEDULED_DOWNLOAD_STARTED':
          notifyScheduledDownloadStarted(
            payload.title,
            payload.episodeTitle,
            payload.reason
          );
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [notifyDownloadComplete, notifyDownloadFailed, notifyScheduledDownloadStarted]);

  // Check for downloads completed while app was closed
  useEffect(() => {
    const checkMissedNotifications = () => {
      const notifications = getRecentNotifications();
      const lastCheck = parseInt(localStorage.getItem('hoyeeh-last-notification-check') || '0', 10);
      
      const missedNotifications = notifications.filter(
        n => n.completedAt > lastCheck && !notifiedRef.current.has(n.id)
      );

      if (missedNotifications.length > 0) {
        if (missedNotifications.length === 1) {
          const n = missedNotifications[0];
          toast.success(`Download complete: ${n.episodeTitle || n.title}`, {
            description: 'Completed while app was closed',
          });
        } else {
          toast.success(`${missedNotifications.length} downloads completed`, {
            description: 'Completed while app was closed',
          });
        }

        missedNotifications.forEach(n => notifiedRef.current.add(n.id));
      }

      localStorage.setItem('hoyeeh-last-notification-check', Date.now().toString());
    };

    // Check on mount and when app becomes visible
    checkMissedNotifications();

    const handleVisibility = () => {
      if (!document.hidden) {
        checkMissedNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [getRecentNotifications]);

  return {
    requestPermission,
    isNotificationsEnabled,
    notifyDownloadComplete,
    notifyScheduledDownloadStarted,
    notifyDownloadFailed,
    notifyBatchProgress,
    getRecentNotifications,
    clearNotifications,
  };
}
