import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { MobileContentRow } from "./MobileContentRow";

interface Props {
  onDetails: (content: Content) => void;
  cardSize?: "sm" | "md" | "lg";
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal" | "full";
  maxItems?: number;
  title?: string;
  sectionBannerUrl?: string;
}

export function MobileNewReleasesForYouRow({
  onDetails, cardSize = "md", cardStyle = "poster", maxItems = 15,
  title = "New Releases For You", sectionBannerUrl,
}: Props) {
  const { user } = useAuth();
  const { data: allContent = [] } = useContent();

  const { data: topGenres = [] } = useQuery({
    queryKey: ["mobile-nrfy-top-genres", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data } = await supabase
        .from("watch_history")
        .select("content:content_id(genre)")
        .eq("user_id", user.id)
        .order("watched_at", { ascending: false })
        .limit(50);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const g = r?.content?.genre;
        if (g) counts[g] = (counts[g] ?? 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
    },
    staleTime: 30 * 60 * 1000,
  });

  const items = useMemo<Content[]>(() => {
    const since = Date.now() - 90 * 86400000;
    const recent = allContent.filter((c) => {
      const t = (c as any).createdAt ? new Date((c as any).createdAt).getTime() : 0;
      return t >= since;
    });
    const pool = topGenres.length > 0 ? recent.filter((c) => topGenres.includes(c.genre)) : recent;
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
    <MobileContentRow
      title={title}
      content={items}
      onDetails={onDetails}
      cardSize={cardSize}
      cardStyle={cardStyle}
      showNewBadge
      sectionBannerUrl={sectionBannerUrl}
    />
  );
}
