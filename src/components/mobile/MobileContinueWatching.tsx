import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Content } from "@/types";
import { MobileContentRow } from "./MobileContentRow";

interface MobileContinueWatchingProps {
  onPlay: (content: Content, progress: number) => void;
  onDetails: (content: Content) => void;
}

export function MobileContinueWatching({ onPlay, onDetails }: MobileContinueWatchingProps) {
  const { user } = useAuth();

  const { data: watchHistory = [] } = useQuery({
    queryKey: ["mobile-continue-watching", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("watch_history")
        .select(`
          content_id,
          progress,
          last_watched,
          content:content_id (
            id, title, description, thumbnail_url, video_url, 
            genre, content_type, is_premium, duration, year
          )
        `)
        .eq("user_id", user.id)
        .gt("progress", 0)
        .lt("progress", 95)
        .order("last_watched", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  if (watchHistory.length === 0) return null;

  const continueWatchingContent: Content[] = watchHistory
    .filter((item: any) => item.content)
    .map((item: any) => ({
      id: item.content.id,
      title: item.content.title,
      description: item.content.description || "",
      thumbnailUrl: item.content.thumbnail_url || "",
      videoUrl: item.content.video_url || "",
      genre: item.content.genre || "",
      contentType: item.content.content_type as "movie" | "series",
      isPremium: item.content.is_premium || false,
      duration: item.content.duration || 0,
      year: item.content.year,
    }));

  const progressMap: Record<string, number> = {};
  watchHistory.forEach((item: any) => {
    if (item.content) {
      progressMap[item.content.id] = item.progress;
    }
  });

  const handleDetails = (content: Content) => {
    const progress = progressMap[content.id] || 0;
    onDetails(content);
  };

  return (
    <MobileContentRow
      title="Continue Watching"
      content={continueWatchingContent}
      onDetails={handleDetails}
      variant="continue"
      progressMap={progressMap}
    />
  );
}
