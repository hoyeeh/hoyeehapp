import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ROTATION_INTERVAL = 6000; // 6 seconds

export interface ProfileBackgroundContent {
  id: string;
  title: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  videoUrl: string | null;
  videoStartTime: number;
  videoDuration: number | null;
  contentType: "movie" | "series";
}

export const useProfileBackground = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch admin-managed backgrounds with scheduling filter
  const { data: backgroundsData = [] } = useQuery({
    queryKey: ["profile-backgrounds"],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from("profile_backgrounds")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      
      // Filter by scheduling dates client-side for flexibility
      return (data || []).filter((item: any) => {
        const startOk = !item.start_date || new Date(item.start_date) <= new Date(now);
        const endOk = !item.end_date || new Date(item.end_date) >= new Date(now);
        return startOk && endOk;
      });
    },
  });

  // Transform to ProfileBackgroundContent
  const allContent = useMemo((): ProfileBackgroundContent[] => {
    return backgroundsData
      .filter((item: any) => item.desktop_image_url || item.mobile_image_url)
      .map((item: any) => ({
        id: item.id,
        title: item.title,
        desktopImageUrl: item.desktop_image_url || "",
        mobileImageUrl: item.mobile_image_url || "",
        videoUrl: item.video_url || null,
        videoStartTime: item.video_start_time || 0,
        videoDuration: item.video_duration || null,
        contentType: item.content_type as "movie" | "series",
      }));
  }, [backgroundsData]);

  // Rotate background every 6 seconds
  useEffect(() => {
    if (allContent.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % allContent.length);
    }, ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, [allContent.length]);

  const backgroundContent = useMemo((): ProfileBackgroundContent | null => {
    if (allContent.length === 0) return null;
    return allContent[currentIndex % allContent.length] || allContent[0];
  }, [allContent, currentIndex]);

  return { backgroundContent };
};
