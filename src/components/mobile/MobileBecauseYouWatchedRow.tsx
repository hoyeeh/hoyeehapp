import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/hooks/useDatabase";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { MobileContentRow } from "./MobileContentRow";

interface MobileBecauseYouWatchedRowProps {
  onDetails: (content: Content) => void;
}

export const MobileBecauseYouWatchedRow = ({
  onDetails,
}: MobileBecauseYouWatchedRowProps) => {
  const { user } = useAuth();
  const { data: allContent = [] } = useContent();

  // Fetch recently completed watch history (progress > 90%)
  const { data: watchHistory = [] } = useQuery({
    queryKey: ["mobile-because-you-watched", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("watch_history")
        .select("*, content:content_id(*)")
        .eq("user_id", user.id)
        .gte("progress", 90)
        .order("last_watched", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Get the most recently watched completed content with a genre
  const sourceContent = useMemo(() => {
    for (const item of watchHistory) {
      if (item.content?.genre) {
        return {
          id: item.content.id,
          title: item.content.title,
          genre: item.content.genre,
        };
      }
    }
    return null;
  }, [watchHistory]);

  // Find related content by matching genre
  const relatedContent = useMemo(() => {
    if (!sourceContent) return [];
    
    const sourceGenres = sourceContent.genre.toLowerCase().split(",").map(g => g.trim());
    
    return allContent
      .filter((c) => {
        if (c.id === sourceContent.id) return false;
        const contentGenres = c.genre.toLowerCase().split(",").map(g => g.trim());
        return sourceGenres.some(sg => contentGenres.some(cg => cg.includes(sg) || sg.includes(cg)));
      })
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, 15);
  }, [allContent, sourceContent]);

  if (!sourceContent || relatedContent.length === 0) {
    return null;
  }

  return (
    <MobileContentRow
      title={`Because You Watched ${sourceContent.title}`}
      content={relatedContent}
      onDetails={onDetails}
      variant="poster"
    />
  );
};
