import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { ContentRow } from "./ContentRow";

interface TopInCountryRowProps {
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
 * Netflix-style "Top 10 in <country>" row.
 * Ranks content by view count in the last 7 days, scoped to the current
 * user's country (from profiles.country). Falls back to global trending
 * when no country is set or no localized views exist.
 */
export const TopInCountryRow = ({
  onPlay,
  onToggleList,
  onDetails,
  userList = [],
  cardStyle = "poster",
  cardSize = "md",
  maxItems = 10,
  title,
}: TopInCountryRowProps) => {
  const { user } = useAuth();
  const { data: allContent = [] } = useContent();

  const { data } = useQuery({
    queryKey: ["top-in-country", user?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      let country: string | null = null;
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("country")
          .eq("id", user.id)
          .maybeSingle();
        country = (prof?.country as string | null) ?? null;
      }

      let query = supabase
        .from("watch_history")
        .select("content_id, user_id")
        .gte("last_watched", since);

      // Country scoping via inner join on profiles
      if (country) {
        const { data: peers } = await supabase
          .from("profiles")
          .select("id")
          .eq("country", country);
        const peerIds = (peers ?? []).map((p: any) => p.id);
        if (peerIds.length > 0) {
          query = query.in("user_id", peerIds);
        }
      }

      const { data: rows } = await query.limit(5000);
      const counts: Record<string, number> = {};
      (rows ?? []).forEach((r: any) => {
        if (r.content_id) counts[r.content_id] = (counts[r.content_id] ?? 0) + 1;
      });
      return { counts, country };
    },
    staleTime: 10 * 60 * 1000,
  });

  const counts = data?.counts ?? {};
  const country = data?.country;

  const ranked: Content[] = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => allContent.find((c) => c.id === id))
    .filter(Boolean) as Content[];

  const items = ranked.slice(0, maxItems);
  if (items.length === 0) return null;

  const heading = title || (country ? `Top ${items.length} in ${country}` : `Top ${items.length} Today`);

  return (
    <ContentRow
      title={heading}
      content={items}
      onPlay={onPlay}
      onToggleList={onToggleList}
      onDetails={onDetails}
      userList={userList}
      cardStyle={cardStyle}
      cardSize={cardSize}
      showRank
    />
  );
};
