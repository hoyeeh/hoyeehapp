import { useCallback, useEffect, useRef } from "react";

interface DownloadProgress {
  contentId: string;
  title: string;
  progress: number;
  status: "downloading" | "completed" | "failed" | "paused";
}

export function useDownloadNotifications() {
  const permissionGranted = useRef(false);
  const activeNotifications = useRef<Map<string, Notification>>(new Map());

  // Request permission on first use
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    
    if (Notification.permission === "granted") {
      permissionGranted.current = true;
      return true;
    }
    
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      permissionGranted.current = permission === "granted";
      return permissionGranted.current;
    }
    
    return false;
  }, []);

  // Send progress to service worker
  const sendProgressToSW = useCallback((progress: DownloadProgress) => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "DOWNLOAD_PROGRESS",
        payload: progress,
      });
    }
  }, []);

  // Show local notification for completion/failure
  const showNotification = useCallback(async (progress: DownloadProgress) => {
    if (!permissionGranted.current) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    // Close existing notification for this content
    const existing = activeNotifications.current.get(progress.contentId);
    if (existing) {
      existing.close();
    }

    let title = "";
    let body = "";
    let icon = "/pwa-icon-192.png";

    switch (progress.status) {
      case "downloading":
        title = `Downloading: ${progress.title}`;
        body = `${Math.round(progress.progress)}% complete`;
        break;
      case "completed":
        title = "Download Complete";
        body = `${progress.title} is ready to watch offline`;
        break;
      case "failed":
        title = "Download Failed";
        body = `Failed to download ${progress.title}`;
        break;
      case "paused":
        title = "Download Paused";
        body = `${progress.title} - ${Math.round(progress.progress)}% complete`;
        break;
    }

    // Use service worker notification if available (works in background)
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon,
          tag: `download-${progress.contentId}`,
          silent: progress.status === "downloading",
        });
      });
    } else {
      // Fallback to regular notification
      const notification = new Notification(title, {
        body,
        icon,
        tag: `download-${progress.contentId}`,
        silent: progress.status === "downloading",
      });
      
      activeNotifications.current.set(progress.contentId, notification);
      
      // Auto-close after 5 seconds for progress updates
      if (progress.status === "downloading") {
        setTimeout(() => notification.close(), 5000);
      }
    }
  }, [requestPermission]);

  // Update download progress
  const updateProgress = useCallback((contentId: string, title: string, progress: number, status: DownloadProgress["status"]) => {
    const payload: DownloadProgress = { contentId, title, progress, status };
    
    // Send to service worker for background tracking
    sendProgressToSW(payload);
    
    // Show notification for significant events
    if (status === "completed" || status === "failed") {
      showNotification(payload);
    } else if (status === "downloading" && (progress === 0 || progress >= 99)) {
      showNotification(payload);
    }
  }, [sendProgressToSW, showNotification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeNotifications.current.forEach((notification) => notification.close());
      activeNotifications.current.clear();
    };
  }, []);

  return {
    requestPermission,
    updateProgress,
    showNotification,
  };
}
