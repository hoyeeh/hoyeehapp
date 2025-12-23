import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useMobileYouTubePlayer } from "@/contexts/MobileYouTubePlayerContext";

interface MobileHomeYouTubeRowProps {
  title?: string;
  maxItems?: number;
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal";
}

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number | null;
}

// Get card dimensions based on style for mobile
const getCardStyles = (style: string) => {
  switch (style) {
    case "poster":
      return { container: "w-28", aspect: "aspect-[2/3]" };
    case "backdrop":
      return { container: "w-48", aspect: "aspect-video" };
    case "wide":
      return { container: "w-40", aspect: "aspect-[4/3]" };
    case "square":
      return { container: "w-32", aspect: "aspect-square" };
    case "minimal":
      return { container: "w-44", aspect: "aspect-video" };
    default:
      return { container: "w-48", aspect: "aspect-video" };
  }
};

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function MobileHomeYouTubeRow({
  title = "YouTube Videos",
  maxItems = 15,
  cardStyle = "backdrop",
}: MobileHomeYouTubeRowProps) {
  const { openPlayer } = useMobileYouTubePlayer();

  // Fetch YouTube videos from channels that should show on mobile
  const { data: videos, isLoading } = useQuery({
    queryKey: ["mobile-home-youtube-videos", maxItems],
    queryFn: async () => {
      // First get channels that show on mobile
      const { data: channels, error: channelsError } = await supabase
        .from("youtube_channels")
        .select("id")
        .eq("is_active", true)
        .eq("show_on_mobile", true);

      if (channelsError) throw channelsError;
      if (!channels || channels.length === 0) return [];

      const channelIds = channels.map((c) => c.id);

      // Get playlists from those channels
      const { data: playlists, error: playlistsError } = await supabase
        .from("youtube_playlists")
        .select("id")
        .in("channel_id", channelIds)
        .eq("is_active", true);

      if (playlistsError) throw playlistsError;
      if (!playlists || playlists.length === 0) return [];

      const playlistIds = playlists.map((p) => p.id);

      // Get videos from those playlists
      const { data: videosData, error: videosError } = await supabase
        .from("youtube_videos")
        .select("*")
        .in("playlist_id", playlistIds)
        .order("published_at", { ascending: false })
        .limit(maxItems);

      if (videosError) throw videosError;
      return videosData as YouTubeVideo[];
    },
  });

  const handleVideoClick = (video: YouTubeVideo) => {
    openPlayer({
      videoId: video.video_id,
      title: video.title,
      thumbnail: video.thumbnail_url || undefined,
    });
  };

  if (isLoading) {
    const styles = getCardStyles(cardStyle);
    return (
      <section className="py-3">
        <div className="px-4 mb-2">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={cn("flex-shrink-0 rounded-lg", styles.container, styles.aspect)} />
          ))}
        </div>
      </section>
    );
  }

  if (!videos || videos.length === 0) return null;

  const styles = getCardStyles(cardStyle);

  return (
    <section className="py-3">
      <div className="px-4 mb-2 flex items-center gap-2">
        <Youtube className="h-4 w-4 text-red-500" />
        <h2 className="font-semibold text-base text-foreground">{title}</h2>
      </div>

      <div
        className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {videos.map((video) => (
          <div
            key={video.id}
            onClick={() => handleVideoClick(video)}
            className={cn("flex-shrink-0 cursor-pointer group active:scale-95 transition-transform", styles.container)}
          >
            <div className={cn("relative rounded-lg overflow-hidden bg-muted", styles.aspect)}>
              {video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-red-700">
                  <Youtube className="h-8 w-8 text-white" />
                </div>
              )}
              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center">
                  <Play className="h-4 w-4 text-white fill-current" />
                </div>
              </div>
              {video.duration && (
                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">
                  {formatDuration(video.duration)}
                </div>
              )}
            </div>
            <h4 className="mt-1.5 text-xs font-medium text-foreground line-clamp-2">
              {video.title}
            </h4>
          </div>
        ))}
      </div>
    </section>
  );
}
