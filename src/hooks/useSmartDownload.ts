import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CACHE_KEYS } from "@/utils/cacheManager";
export function useSmartDownload() {
  const { user } = useAuth();
  const [smartDownloadEnabled, setSmartDownloadEnabled] = useState(() => 
    localStorage.getItem("smart-download") === "true"
  );

  const toggleSmartDownload = useCallback((enabled: boolean) => {
    setSmartDownloadEnabled(enabled);
    localStorage.setItem("smart-download", enabled.toString());
  }, []);

  // Check for next episode and queue download
  const checkAndQueueNextEpisode = useCallback(async (
    episodeId: string,
    seasonId: string
  ) => {
    if (!smartDownloadEnabled || !user) return;

    // Check if on WiFi
    const connection = (navigator as any).connection;
    const isWifi = !connection || connection.type === "wifi" || connection.effectiveType === "4g";
    const wifiOnly = localStorage.getItem(CACHE_KEYS.downloads.wifiOnly) === "true";
    
    if (wifiOnly && !isWifi) return;

    try {
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
        .select("id, title, episode_number, season:season_id(content:content_id(title))")
        .eq("season_id", seasonId)
        .eq("episode_number", currentEp.episode_number + 1)
        .single();

      if (!nextEp) return;

      // Check if already downloaded
      const { data: existingLicense } = await supabase
        .from("download_licenses")
        .select("id")
        .eq("user_id", user.id)
        .eq("episode_id", nextEp.id)
        .maybeSingle();

      if (existingLicense) return;

      // Queue the next episode for download
      toast.info(`Smart Download: Queuing "${nextEp.title}"`, {
        description: "Next episode will download automatically"
      });

      // Trigger download start via edge function
      await supabase.functions.invoke("download-start", {
        body: {
          episodeId: nextEp.id,
          quality: localStorage.getItem("preferred-download-quality") || "720p"
        }
      });

    } catch (error) {
      console.error("Smart download error:", error);
    }
  }, [smartDownloadEnabled, user]);

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
            // Get season info
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

  return {
    smartDownloadEnabled,
    toggleSmartDownload,
    checkAndQueueNextEpisode
  };
}
