import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play, Youtube } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface KidsMobileYouTubeRowProps {
  onPlayVideo: (videoId: string, title: string) => void;
}

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number;
}

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const KidsMobileYouTubeRow = ({ onPlayVideo }: KidsMobileYouTubeRowProps) => {
  // Fetch kids-friendly YouTube channels and their videos (mobile only)
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["kids-youtube-videos-mobile"],
    queryFn: async () => {
      // Get kids-friendly channels that should show on mobile
      const { data: channels, error: channelsError } = await supabase
        .from("youtube_channels")
        .select("id")
        .eq("is_active", true)
        .eq("is_kids_friendly", true)
        .eq("show_on_mobile", true);

      if (channelsError) throw channelsError;
      if (!channels?.length) return [];

      // Get playlists from those channels
      const { data: playlists, error: playlistsError } = await supabase
        .from("youtube_playlists")
        .select("id")
        .in("channel_id", channels.map((c) => c.id))
        .eq("is_active", true);

      if (playlistsError) throw playlistsError;
      if (!playlists?.length) return [];

      // Get videos from those playlists
      const { data: videosData, error: videosError } = await supabase
        .from("youtube_videos")
        .select("*")
        .in("playlist_id", playlists.map((p) => p.id))
        .order("position")
        .limit(12);

      if (videosError) throw videosError;
      return videosData as YouTubeVideo[];
    },
  });

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 px-5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <Youtube className="h-4 w-4 text-white" />
          </div>
          <Skeleton className="h-5 w-24 bg-white/[0.04]" />
        </div>
        <div className="flex gap-3 px-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="w-[160px] aspect-video rounded-xl bg-white/[0.04] flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (videos.length === 0) return null;

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-4 bg-gradient-to-br from-red-500/20 via-red-500/10 to-rose-500/20 rounded-xl mx-3 py-4 border border-red-500/20"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
          <Youtube className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">YouTube Videos</h2>
      </div>

      {/* Videos Row */}
      <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
        {videos.map((video, index) => (
          <motion.button
            key={video.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onPlayVideo(video.video_id, video.title)}
            className="flex-shrink-0 w-[160px]"
          >
            <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-red-500/20 to-rose-600/20">
              <img
                src={video.thumbnail_url || `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
                alt={video.title}
                className="w-full h-full object-cover"
              />
              
              {/* Play Button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <Play className="h-5 w-5 text-[#0A0A0F] ml-0.5" fill="currentColor" />
                </div>
              </div>

              {/* Duration Badge */}
              {video.duration && (
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-medium">
                  {formatDuration(video.duration)}
                </div>
              )}
            </div>

            <p className="mt-2 text-[12px] font-medium text-white/80 line-clamp-2 text-left">
              {video.title}
            </p>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
};
