import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/hooks/useDatabase";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { ContentRow } from "./ContentRow";
import { Sparkles } from "lucide-react";

interface BecauseYouWatchedRowProps {
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  userList?: string[];
}

export const BecauseYouWatchedRow = ({
  onPlay,
  onToggleList,
  onDetails,
  userList = [],
}: BecauseYouWatchedRowProps) => {
  const { user } = useAuth();
  const { data: allContent = [] } = useContent();

  // Fetch recently completed watch history (progress > 90%)
  const { data: watchHistory = [] } = useQuery({
    queryKey: ["because-you-watched", user?.id],
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
    staleTime: 5 * 60 * 1000, // 5 minutes
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
        // Exclude the source content itself
        if (c.id === sourceContent.id) return false;
        
        // Match by genre
        const contentGenres = c.genre.toLowerCase().split(",").map(g => g.trim());
        return sourceGenres.some(sg => contentGenres.some(cg => cg.includes(sg) || sg.includes(cg)));
      })
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, 15);
  }, [allContent, sourceContent]);

  if (!sourceContent || relatedContent.length === 0) {
    return null;
  }

  const title = `Because You Watched ${sourceContent.title}`;

  return (
    <ContentRow
      title={title}
      content={relatedContent}
      onPlay={onPlay}
      onToggleList={onToggleList}
      onDetails={onDetails}
      userList={userList}
      cardStyle="poster"
    />
  );
};
