import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { ContentRow } from "./ContentRow";

interface NewReleasesForYouRowProps {
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  userList?: string[];
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal";
  cardSize?: "sm" | "md" | "lg";
  maxItems?: number;
  title?: string;
}

/**
 * Netflix-style "New Releases For You" row.
 * Filters the platform's newest content by the visitor's top 3 watched
 * genres. Falls back to all newest content if there is no watch history.
 */
export const NewReleasesForYouRow = ({
  onPlay,
  onToggleList,
  onDetails,
  userList = [],
  cardStyle = "poster",
  cardSize = "md",
  maxItems = 15,
  title = "New Releases For You",
}: NewReleasesForYouRowProps) => {
  const { user } = useAuth();
  const { data: allContent = [] } = useContent();

  const { data: topGenres = [] } = useQuery({
    queryKey: ["nrfy-top-genres", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data: history } = await supabase
        .from("watch_history")
        .select("content_id")
        .eq("user_id", user.id)
        .order("watched_at", { ascending: false })
        .limit(50);
      const ids = [...new Set((history ?? []).map((row) => row.content_id).filter(Boolean))];
      if (ids.length === 0) return [] as string[];
      const { data: watchedContent } = await supabase
        .from("content_public" as any)
        .select("id, genre")
        .in("id", ids);
      const counts: Record<string, number> = {};
      (watchedContent ?? []).forEach((r: any) => {
        const g = r?.genre;
        if (g) counts[g] = (counts[g] ?? 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);
    },
    staleTime: 30 * 60 * 1000,
  });

  const items = useMemo<Content[]>(() => {
    const ninetyDaysAgo = Date.now() - 90 * 86400000;
    const recent = allContent.filter((c) => {
      const created = (c as any).createdAt
        ? new Date((c as any).createdAt).getTime()
        : 0;
      return created >= ninetyDaysAgo;
    });
    const pool =
      topGenres.length > 0
        ? recent.filter((c) => topGenres.includes(c.genre))
        : recent;
    return pool
      .sort((a, b) => {
        const da = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const db = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        return db - da;
      })
      .slice(0, maxItems);
  }, [allContent, topGenres, maxItems]);

  if (items.length === 0) return null;

  return (
    <ContentRow
      title={title}
      content={items}
      onPlay={onPlay}
      onToggleList={onToggleList}
      onDetails={onDetails}
      userList={userList}
      cardStyle={cardStyle}
      cardSize={cardSize}
    />
  );
};
