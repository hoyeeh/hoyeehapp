import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play, Youtube, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface KidsYouTubeRowProps {
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

export const KidsYouTubeRow = ({ onPlayVideo }: KidsYouTubeRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Fetch kids-friendly YouTube channels and their videos (desktop only)
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["kids-youtube-videos-desktop"],
    queryFn: async () => {
      // Get kids-friendly channels that should show on desktop
      const { data: channels, error: channelsError } = await supabase
        .from("youtube_channels")
        .select("id")
        .eq("is_active", true)
        .eq("is_kids_friendly", true)
        .eq("show_on_desktop", true);

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
        .limit(20);

      if (videosError) throw videosError;
      return videosData as YouTubeVideo[];
    },
  });

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <Youtube className="h-5 w-5 text-white" />
          </div>
          <Skeleton className="h-6 w-32 bg-white/[0.04]" />
        </div>
        <div className="flex gap-4 px-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="w-[200px] aspect-video rounded-2xl bg-white/[0.04] flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (videos.length === 0) return null;

  return (
    <motion.section 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-4 relative bg-gradient-to-br from-red-500/20 via-red-500/10 to-rose-500/20 rounded-2xl p-4 md:p-6 mx-6 border border-red-500/20"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
          <Youtube className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">YouTube Videos</h2>
      </div>

      {/* Videos Row */}
      <div className="relative group">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-hide"
        >
          {videos.map((video, index) => (
            <motion.button
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onPlayVideo(video.video_id, video.title)}
              className="flex-shrink-0 w-[200px] group/card"
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-red-500/20 to-rose-600/20">
                <img
                  src={video.thumbnail_url || `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
                  alt={video.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                />
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-xl">
                    <Play className="h-7 w-7 text-[#0A0A0F] ml-1" fill="currentColor" />
                  </div>
                </div>

                {/* Duration Badge */}
                {video.duration && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/80 text-white text-xs font-medium">
                    {formatDuration(video.duration)}
                  </div>
                )}
              </div>

              <p className="mt-2 text-sm font-medium text-white/80 line-clamp-2 text-left group-hover/card:text-white transition-colors">
                {video.title}
              </p>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.section>
  );
};
