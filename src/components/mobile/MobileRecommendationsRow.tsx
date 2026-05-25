import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Content } from "@/types";
import { MobileContentRow } from "./MobileContentRow";

interface MobileRecommendationsRowProps {
  title?: string;
  onDetails: (content: Content) => void;
  cardSize?: "sm" | "md" | "lg";
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal" | "full";
  sectionBannerUrl?: string;
  maxItems?: number;
}

/**
 * Mobile renderer for admin-configured "recommendations" home sections.
 * Mirrors the desktop RecommendationsRow data source (get-recommendations
 * edge function) but renders inside the standard MobileContentRow shell.
 */
export function MobileRecommendationsRow({
  title = "Recommended For You",
  onDetails,
  cardSize = "md",
  cardStyle = "poster",
  sectionBannerUrl,
  maxItems = 15,
}: MobileRecommendationsRowProps) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["mobile-recommendations", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.functions.invoke("get-recommendations", {
        body: { userId: user.id },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  if (!user) return null;

  const items: Content[] = ((data as any)?.recommendations || (data as any)?.content || [])
    .map((raw: any): Content | null => {
      if (!raw?.id) return null;
      return {
        id: raw.id,
        title: raw.title,
        description: raw.description || "",
        thumbnailUrl: raw.thumbnail_url || raw.thumbnailUrl || "",
        videoUrl: raw.video_url || raw.videoUrl || "",
        genre: raw.genre || "",
        contentType: (raw.content_type || raw.contentType) as "movie" | "series",
        isPremium: raw.is_premium || raw.isPremium || false,
        duration: raw.duration || 0,
        year: raw.year,
        rating: raw.rating,
      };
    })
    .filter(Boolean)
    .slice(0, maxItems);

  if (!isLoading && items.length === 0) return null;

  return (
    <MobileContentRow
      title={title}
      content={items}
      onDetails={onDetails}
      isLoading={isLoading}
      cardSize={cardSize}
      cardStyle={cardStyle}
      sectionBannerUrl={sectionBannerUrl}
    />
  );
}
