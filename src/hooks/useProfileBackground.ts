import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PROFILE_BG_KEY = "hoyeeh-profile-background";
const PROFILE_BG_EXPIRY = 6 * 60 * 60 * 1000; // 6 hours

export interface ProfileBackgroundContent {
  id: string;
  title: string;
  thumbnailUrl: string;
  contentType: "movie" | "series";
}

export const useProfileBackground = () => {
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

  // Combine and select random content
  const backgroundContent = useMemo((): ProfileBackgroundContent | null => {
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
    const allContent = [...top10Items];
    mostViewedItems.forEach((item) => {
      if (!allContent.find((c) => c.id === item.id)) {
        allContent.push(item);
      }
    });

    if (allContent.length === 0) return null;

    // Check localStorage for persisted selection
    try {
      const stored = localStorage.getItem(PROFILE_BG_KEY);
      if (stored) {
        const { contentId, timestamp } = JSON.parse(stored);
        if (Date.now() - timestamp < PROFILE_BG_EXPIRY) {
          const found = allContent.find((c) => c.id === contentId);
          if (found) return found;
        }
      }
    } catch {}

    // Select random content and persist
    const randomIndex = Math.floor(Math.random() * allContent.length);
    const selected = allContent[randomIndex];

    try {
      localStorage.setItem(
        PROFILE_BG_KEY,
        JSON.stringify({ contentId: selected.id, timestamp: Date.now() })
      );
    } catch {}

    return selected;
  }, [top10Data, mostViewedData]);

  return { backgroundContent };
};
