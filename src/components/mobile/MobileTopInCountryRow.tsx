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

export function MobileTopInCountryRow({
  onDetails, cardSize = "md", cardStyle = "poster", maxItems = 10, title, sectionBannerUrl,
}: Props) {
  const { user } = useAuth();
  const { data: allContent = [] } = useContent();

  const { data } = useQuery({
    queryKey: ["mobile-top-in-country", user?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      let country: string | null = null;
      if (user?.id) {
        const { data: prof } = await supabase.from("profiles").select("country").eq("id", user.id).maybeSingle();
        country = (prof?.country as string | null) ?? null;
      }
      let q = supabase.from("watch_history").select("content_id, user_id").gte("watched_at", since);
      if (country) {
        const { data: peers } = await supabase.from("profiles").select("id").eq("country", country);
        const peerIds = (peers ?? []).map((p: any) => p.id);
        if (peerIds.length > 0) q = q.in("user_id", peerIds);
      }
      const { data: rows } = await q.limit(5000);
      const counts: Record<string, number> = {};
      (rows ?? []).forEach((r: any) => { if (r.content_id) counts[r.content_id] = (counts[r.content_id] ?? 0) + 1; });
      return { counts, country };
    },
    staleTime: 10 * 60 * 1000,
  });

  const counts = data?.counts ?? {};
  const ranked: Content[] = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => allContent.find((c) => c.id === id))
    .filter(Boolean) as Content[];
  const items = ranked.slice(0, maxItems);
  if (items.length === 0) return null;

  const heading = title || (data?.country ? `Top ${items.length} in ${data.country}` : `Top ${items.length} Today`);

  return (
    <MobileContentRow
      title={heading}
      content={items}
      onDetails={onDetails}
      showRank
      cardSize={cardSize}
      cardStyle={cardStyle}
      sectionBannerUrl={sectionBannerUrl}
    />
  );
}
