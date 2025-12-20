import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CACHE_KEYS } from "@/utils/cacheManager";

interface SmartDownloadQueue {
  episodeId: string;
  title: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  showTitle?: string;
}

export function useSmartDownload() {
  const { user } = useAuth();
  const [smartDownloadEnabled, setSmartDownloadEnabled] = useState(() => 
    localStorage.getItem("smart-download") === "true"
  );
  const [downloadQueue, setDownloadQueue] = useState<SmartDownloadQueue[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleSmartDownload = useCallback((enabled: boolean) => {
    setSmartDownloadEnabled(enabled);
    localStorage.setItem("smart-download", enabled.toString());
  }, []);

  // Check if on WiFi
  const checkWifiConnection = useCallback(() => {
    const connection = (navigator as any).connection;
    const isWifi = !connection || connection.type === "wifi" || connection.effectiveType === "4g";
    const wifiOnly = localStorage.getItem(CACHE_KEYS.downloads.wifiOnly) === "true";
    return !wifiOnly || isWifi;
  }, []);

  // Get preferred download quality
  const getDownloadQuality = useCallback(() => {
    return localStorage.getItem("hoyeeh_download_quality") || "medium";
  }, []);

  // Check for next episode and queue download
  const checkAndQueueNextEpisode = useCallback(async (
    episodeId: string,
    seasonId: string
  ) => {
    if (!smartDownloadEnabled || !user) return;

    if (!checkWifiConnection()) {
      console.log("Smart Download: Skipped - not on WiFi");
      return;
    }

    try {
      setIsProcessing(true);
      
      // Get current episode number
      const { data: currentEp } = await supabase
        .from("episodes")
        .select("episode_number")
        .eq("id", episodeId)
        .single();

      if (!currentEp) return;

      // Get next episode
      const { data: nextEp } = await supabase
        .from("episodes")
        .select(`
          id, 
          title, 
          episode_number, 
          season:season_id (
            season_number,
            content:content_id (title)
          )
        `)
        .eq("season_id", seasonId)
        .eq("episode_number", currentEp.episode_number + 1)
        .single();

      if (!nextEp) {
        console.log("Smart Download: No next episode available");
        return;
      }

      // Check if already downloaded
      const { data: existingLicense } = await supabase
        .from("download_licenses")
        .select("id")
        .eq("user_id", user.id)
        .eq("episode_id", nextEp.id)
        .maybeSingle();

      if (existingLicense) {
        console.log("Smart Download: Episode already downloaded");
        return;
      }

      // Check if already in queue
      const alreadyQueued = downloadQueue.some(item => item.episodeId === nextEp.id);
      if (alreadyQueued) {
        console.log("Smart Download: Episode already in queue");
        return;
      }

      // Add to queue
      const seasonData = nextEp.season as any;
      const showTitle = seasonData?.content?.title || "Unknown Show";
      
      const queueItem: SmartDownloadQueue = {
        episodeId: nextEp.id,
        title: nextEp.title,
        status: 'queued',
        showTitle,
      };

      setDownloadQueue(prev => [...prev, queueItem]);

      toast.info(`Smart Download: Queuing "${nextEp.title}"`, {
        description: `Next episode of ${showTitle} will download automatically`
      });

      // Trigger download
      const { error } = await supabase.functions.invoke("download-start", {
        body: {
          episodeId: nextEp.id,
          quality: getDownloadQuality(),
          deviceId: localStorage.getItem("device-id") || "web"
        }
      });

      if (error) {
        setDownloadQueue(prev => 
          prev.map(item => 
            item.episodeId === nextEp.id 
              ? { ...item, status: 'failed' }
              : item
          )
        );
        console.error("Smart download error:", error);
      } else {
        setDownloadQueue(prev => 
          prev.map(item => 
            item.episodeId === nextEp.id 
              ? { ...item, status: 'downloading' }
              : item
          )
        );
      }

    } catch (error) {
      console.error("Smart download error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [smartDownloadEnabled, user, downloadQueue, checkWifiConnection, getDownloadQuality]);

  // Listen for completed downloads
  useEffect(() => {
    if (!smartDownloadEnabled || !user) return;

    const channel = supabase
      .channel("smart-download-listener")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "download_licenses",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const license = payload.new as any;
          
          // Check if download just completed
          if (license.status === "active" && license.episode_id) {
            // Update queue status
            setDownloadQueue(prev => 
              prev.map(item => 
                item.episodeId === license.episode_id 
                  ? { ...item, status: 'completed' }
                  : item
              )
            );

            // Get season info for next episode
            const { data: episode } = await supabase
              .from("episodes")
              .select("season_id")
              .eq("id", license.episode_id)
              .single();
            
            if (episode?.season_id) {
              checkAndQueueNextEpisode(license.episode_id, episode.season_id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [smartDownloadEnabled, user, checkAndQueueNextEpisode]);

  // Clear completed items from queue periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      setDownloadQueue(prev => 
        prev.filter(item => item.status !== 'completed' && item.status !== 'failed')
      );
    }, 30000); // Every 30 seconds

    return () => clearInterval(cleanup);
  }, []);

  return {
    smartDownloadEnabled,
    toggleSmartDownload,
    checkAndQueueNextEpisode,
    downloadQueue,
    isProcessing,
    checkWifiConnection,
    getDownloadQuality,
  };
}
