import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface DownloadNotificationOptions {
  title: string;
  episodeTitle?: string;
  progress: number;
  status: 'downloading' | 'completed' | 'failed' | 'paused';
  thumbnailUrl?: string;
}

export function useBackgroundDownloadNotifications() {
  const { user } = useAuth();
  const notificationRef = useRef<Notification | null>(null);
  const progressUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  // Check if notifications are supported and permitted
  const canShowNotifications = useCallback(() => {
    return 'Notification' in window && Notification.permission === 'granted';
  }, []);

  // Show download progress notification
  const showDownloadProgress = useCallback(async (options: DownloadNotificationOptions) => {
    if (!canShowNotifications()) {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;
    }

    // Throttle progress updates to avoid spamming notifications
    if (options.status === 'downloading' && progressUpdateTimeoutRef.current) {
      return;
    }

    // Close existing notification
    if (notificationRef.current) {
      notificationRef.current.close();
    }

    let body = '';
    let icon = '/pwa-icon-192.png';
    let tag = 'download-progress';

    switch (options.status) {
      case 'downloading':
        body = `${options.progress.toFixed(0)}% downloaded`;
        if (options.episodeTitle) {
          body = `${options.episodeTitle} - ${body}`;
        }
        // Throttle downloading notifications
        progressUpdateTimeoutRef.current = setTimeout(() => {
          progressUpdateTimeoutRef.current = null;
        }, 5000); // Only update every 5 seconds
        break;
      
      case 'completed':
        body = options.episodeTitle 
          ? `${options.episodeTitle} is ready to watch offline`
          : 'Download complete - ready to watch offline';
        tag = 'download-complete';
        break;
      
      case 'failed':
        body = options.episodeTitle 
          ? `Failed to download ${options.episodeTitle}`
          : 'Download failed - please try again';
        tag = 'download-failed';
        break;
      
      case 'paused':
        body = options.episodeTitle 
          ? `${options.episodeTitle} paused at ${options.progress.toFixed(0)}%`
          : `Download paused at ${options.progress.toFixed(0)}%`;
        tag = 'download-paused';
        break;
    }

    try {
      const notification = new Notification(options.title, {
        body,
        icon: options.thumbnailUrl || icon,
        tag,
        silent: options.status === 'downloading', // Silent for progress updates
        requireInteraction: options.status === 'completed' || options.status === 'failed',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      notificationRef.current = notification;
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }, [canShowNotifications, requestPermission]);

  // Show smart download notification
  const showSmartDownloadQueued = useCallback(async (
    showTitle: string,
    episodeTitle: string
  ) => {
    if (!canShowNotifications()) {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;
    }

    try {
      new Notification('Smart Download', {
        body: `Next episode of ${showTitle} queued: ${episodeTitle}`,
        icon: '/pwa-icon-192.png',
        tag: 'smart-download',
        silent: true,
      });
    } catch (error) {
      console.error('Failed to show smart download notification:', error);
    }
  }, [canShowNotifications, requestPermission]);

  // Show batch download complete notification
  const showBatchComplete = useCallback(async (
    count: number,
    showTitle?: string
  ) => {
    if (!canShowNotifications()) {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;
    }

    try {
      new Notification('Downloads Complete', {
        body: showTitle 
          ? `${count} episodes of ${showTitle} are ready to watch`
          : `${count} downloads are ready to watch offline`,
        icon: '/pwa-icon-192.png',
        tag: 'batch-download-complete',
        requireInteraction: true,
      });
    } catch (error) {
      console.error('Failed to show batch notification:', error);
    }
  }, [canShowNotifications, requestPermission]);

  // Show storage warning notification
  const showStorageWarning = useCallback(async (percentUsed: number) => {
    if (!canShowNotifications()) return;

    try {
      new Notification('Storage Warning', {
        body: `Your download storage is ${percentUsed.toFixed(0)}% full. Consider removing some downloads.`,
        icon: '/pwa-icon-192.png',
        tag: 'storage-warning',
        requireInteraction: true,
      });
    } catch (error) {
      console.error('Failed to show storage warning:', error);
    }
  }, [canShowNotifications]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (notificationRef.current) {
        notificationRef.current.close();
      }
      if (progressUpdateTimeoutRef.current) {
        clearTimeout(progressUpdateTimeoutRef.current);
      }
    };
  }, []);

  return {
    requestPermission,
    canShowNotifications,
    showDownloadProgress,
    showSmartDownloadQueued,
    showBatchComplete,
    showStorageWarning,
    isSupported: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'denied',
  };
}