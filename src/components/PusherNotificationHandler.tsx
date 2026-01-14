import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// Pusher client-side configuration from environment variables
const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || '';
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'us2';

interface PusherNotification {
  title: string;
  body: string;
  type?: string;
  contentId?: string;
}

interface SubtitleProgressData {
  title: string;
  body: string;
  contentId?: string;
  episodeId?: string;
  status: 'started' | 'completed' | 'failed';
}

/**
 * Global Pusher notification handler that:
 * 1. Connects to Pusher when user is authenticated
 * 2. Listens for real-time notifications
 * 3. Shows toast notifications
 * 4. Invalidates React Query cache to refresh notification list
 */
export function PusherNotificationHandler() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleNotification = useCallback((data: PusherNotification) => {
    // Show toast notification
    toast(data.title, {
      description: data.body,
      action: data.contentId
        ? {
            label: "View",
            onClick: () => navigate(`/content/${data.contentId}`),
          }
        : undefined,
    });

    // Invalidate notification queries to refresh the list
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });

    // Show browser notification if permitted
    if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
      try {
        new Notification(data.title, {
          body: data.body,
          icon: "/favicon.png",
        });
      } catch (e) {
        // Browser notifications might fail in some contexts
        console.warn("Browser notification failed:", e);
      }
    }
  }, [queryClient, navigate]);

  // Handle subtitle generation progress notifications
  const handleSubtitleProgress = useCallback((data: SubtitleProgressData) => {
    if (data.status === 'started') {
      toast.info(data.title, { description: data.body });
    } else if (data.status === 'completed') {
      toast.success(data.title, { description: data.body });
      queryClient.invalidateQueries({ queryKey: ['subtitles'] });
      queryClient.invalidateQueries({ queryKey: ['subtitle-generation-logs'] });
    } else if (data.status === 'failed') {
      toast.error(data.title, { description: data.body });
    }
  }, [queryClient]);

  useEffect(() => {
    if (!user) return;

    // Listen for service worker sync messages
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_NOTIFICATIONS") {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      }
    };
    
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    // Skip if no Pusher key configured
    if (!PUSHER_KEY) {
      console.log("Pusher key not configured - real-time notifications disabled");
      return () => {
        navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
      };
    }

    let pusherInstance: any = null;
    let cleanup: (() => void) | undefined;

    const initializePusher = (PusherClass: any) => {
      try {
        pusherInstance = new PusherClass(PUSHER_KEY, {
          cluster: PUSHER_CLUSTER,
          forceTLS: true,
        });

        // Subscribe to public channel for broadcast notifications
        const publicChannel = pusherInstance.subscribe("public-notifications");
        publicChannel.bind("notification", handleNotification);

        // Subscribe to user-specific channel for personal notifications
        const userChannel = pusherInstance.subscribe(`user-${user.id}`);
        userChannel.bind("notification", handleNotification);
        userChannel.bind("subtitle-progress", handleSubtitleProgress);

        pusherInstance.connection.bind("connected", () => {
          console.log("[Pusher] Connected for real-time notifications");
        });

        pusherInstance.connection.bind("error", (err: any) => {
          console.error("[Pusher] Connection error:", err);
        });

        cleanup = () => {
          if (pusherInstance) {
            pusherInstance.unsubscribe("public-notifications");
            pusherInstance.unsubscribe(`user-${user.id}`);
            pusherInstance.disconnect();
          }
        };
      } catch (error) {
        console.error("[Pusher] Initialization error:", error);
      }
    };

    // Load Pusher dynamically
    const loadPusher = async () => {
      try {
        // Check if Pusher is already loaded
        if ((window as any).Pusher) {
          initializePusher((window as any).Pusher);
          return;
        }

        // Load Pusher script
        const script = document.createElement("script");
        script.src = "https://js.pusher.com/8.2.0/pusher.min.js";
        script.async = true;
        script.onload = () => {
          initializePusher((window as any).Pusher);
        };
        script.onerror = () => {
          console.error("[Pusher] Failed to load Pusher script");
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error("[Pusher] Failed to load:", error);
      }
    };

    loadPusher();

    return () => {
      cleanup?.();
    };
  }, [user, handleNotification, handleSubtitleProgress]);

  // This component doesn't render anything
  return null;
}
