import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ROTATION_INTERVAL = 6000; // 6 seconds

export interface ProfileBackgroundContent {
  id: string;
  title: string;
  thumbnailUrl: string;
  contentType: "movie" | "series";
}

export const useProfileBackground = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch top 10 content
  const { data: top10Data = [] } = useQuery({
    queryKey: ["profile-bg-top10"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top_10")
        .select(`content:content_id (id, title, thumbnail_url, content_type)`)
        .order("rank")
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch most viewed content
  const { data: mostViewedData = [] } = useQuery({
    queryKey: ["profile-bg-most-viewed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, thumbnail_url, content_type")
        .order("view_count", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Combine and deduplicate content
  const allContent = useMemo((): ProfileBackgroundContent[] => {
    const top10Items = top10Data
      .filter((item: any) => item.content)
      .map((item: any) => ({
        id: item.content.id,
        title: item.content.title,
        thumbnailUrl: item.content.thumbnail_url || "",
        contentType: item.content.content_type as "movie" | "series",
      }));

    const mostViewedItems = mostViewedData.map((item: any) => ({
      id: item.id,
      title: item.title,
      thumbnailUrl: item.thumbnail_url || "",
      contentType: item.content_type as "movie" | "series",
    }));

    // Combine and deduplicate
    const combined = [...top10Items];
    mostViewedItems.forEach((item) => {
      if (!combined.find((c) => c.id === item.id)) {
        combined.push(item);
      }
    });

    return combined;
  }, [top10Data, mostViewedData]);

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
