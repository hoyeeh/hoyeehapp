import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY || '';
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'us2';

interface SubtitleProgressData {
  title: string;
  body: string;
  contentId?: string;
  episodeId?: string;
  status: 'started' | 'completed' | 'failed';
}

export function useSubtitleNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleProgress = useCallback((data: SubtitleProgressData) => {
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
    if (!user || !PUSHER_KEY) return;

    let pusher: any = null;

    const init = () => {
      if (!(window as any).Pusher) return;
      
      pusher = new (window as any).Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        forceTLS: true,
      });

      const channel = pusher.subscribe(`user-${user.id}`);
      channel.bind('subtitle-progress', handleProgress);
    };

    if ((window as any).Pusher) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = 'https://js.pusher.com/8.2.0/pusher.min.js';
      script.onload = init;
      document.head.appendChild(script);
    }

    return () => {
      if (pusher) {
        pusher.unsubscribe(`user-${user.id}`);
        pusher.disconnect();
      }
    };
  }, [user, handleProgress]);
}
