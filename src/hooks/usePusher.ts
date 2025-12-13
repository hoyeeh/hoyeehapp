import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Pusher client-side configuration from environment variables
const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || '';
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'us2';

interface PusherNotification {
  title: string;
  body: string;
  type?: string;
  contentId?: string;
}

export const usePusher = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [pusher, setPusher] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Dynamically load Pusher
    const loadPusher = async () => {
      try {
        // Skip if no Pusher key configured
        if (!PUSHER_KEY) {
          console.warn("Pusher key not configured - real-time notifications disabled");
          return;
        }

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
        document.head.appendChild(script);
      } catch (error) {
        console.error("Failed to load Pusher:", error);
      }
    };

    const initializePusher = (PusherClass: any) => {
      try {
        const pusherInstance = new PusherClass(PUSHER_KEY, {
          cluster: PUSHER_CLUSTER,
          forceTLS: true,
        });

        // Subscribe to public channel
        const publicChannel = pusherInstance.subscribe("public-notifications");
        publicChannel.bind("notification", (data: PusherNotification) => {
          handleNotification(data);
        });

        // Subscribe to user-specific channel
        const userChannel = pusherInstance.subscribe(`private-user-${user.id}`);
        userChannel.bind("notification", (data: PusherNotification) => {
          handleNotification(data);
        });

        pusherInstance.connection.bind("connected", () => {
          setIsConnected(true);
          console.log("Pusher connected");
        });

        pusherInstance.connection.bind("disconnected", () => {
          setIsConnected(false);
          console.log("Pusher disconnected");
        });

        setPusher(pusherInstance);
      } catch (error) {
        console.error("Pusher initialization error:", error);
      }
    };

    loadPusher();

    return () => {
      if (pusher) {
        pusher.disconnect();
      }
    };
  }, [user]);

  const handleNotification = useCallback((data: PusherNotification) => {
    // Show toast notification
    toast(data.title, {
      description: data.body,
      action: data.contentId
        ? {
            label: "View",
            onClick: () => {
              window.location.href = `/content/${data.contentId}`;
            },
          }
        : undefined,
    });

    // Also trigger browser notification if permitted
    if (Notification.permission === "granted") {
      new Notification(data.title, {
        body: data.body,
        icon: "/favicon.png",
      });
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    return Notification.permission === "granted";
  }, []);

  return {
    isConnected,
    requestNotificationPermission,
  };
};

export default usePusher;
