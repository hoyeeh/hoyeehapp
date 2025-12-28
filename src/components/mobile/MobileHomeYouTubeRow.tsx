import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play, Youtube, X, Users, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useMobileYouTubePlayer } from "@/contexts/MobileYouTubePlayerContext";
import { motion, AnimatePresence } from "framer-motion";

interface MobileHomeYouTubeRowProps {
  title?: string;
  maxItems?: number;
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal";
}

interface YouTubeChannel {
  id: string;
  name: string;
  thumbnail_url: string | null;
  cover_url: string | null;
  subscriber_count: string | null;
  video_count: number | null;
}

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number | null;
}

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function MobileHomeYouTubeRow({
  title = "Channels",
  maxItems = 10,
}: MobileHomeYouTubeRowProps) {
  const { openPlayer } = useMobileYouTubePlayer();
  const [selectedChannel, setSelectedChannel] = useState<YouTubeChannel | null>(null);

  // Fetch YouTube channels that should show on mobile
  const { data: channels, isLoading } = useQuery({
    queryKey: ["mobile-home-youtube-channels", maxItems],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_channels")
        .select("id, name, thumbnail_url, cover_url, subscriber_count, video_count")
        .eq("is_active", true)
        .eq("show_on_mobile", true)
        .order("display_order", { ascending: true })
        .limit(maxItems);

      if (error) throw error;
      return data as YouTubeChannel[];
    },
  });

  // Fetch videos for selected channel
  const { data: channelVideos, isLoading: videosLoading } = useQuery({
    queryKey: ["mobile-channel-videos", selectedChannel?.id],
    queryFn: async () => {
      if (!selectedChannel) return [];
      
      const { data: channelPlaylists, error: playlistsError } = await supabase
        .from("youtube_playlists")
        .select("id")
        .eq("channel_id", selectedChannel.id)
        .eq("is_active", true);

      if (playlistsError) throw playlistsError;
      if (!channelPlaylists || channelPlaylists.length === 0) return [];

      const playlistIds = channelPlaylists.map((p) => p.id);

      const { data: videosData, error: videosError } = await supabase
        .from("youtube_videos")
        .select("*")
        .in("playlist_id", playlistIds)
        .order("published_at", { ascending: false })
        .limit(15);

      if (videosError) throw videosError;
      return videosData as YouTubeVideo[];
    },
    enabled: !!selectedChannel,
  });

  const handleChannelClick = (channel: YouTubeChannel) => {
    if (selectedChannel?.id === channel.id) {
      setSelectedChannel(null);
    } else {
      setSelectedChannel(channel);
    }
  };

  const handleVideoClick = (video: YouTubeVideo) => {
    openPlayer({
      videoId: video.video_id,
      title: video.title,
      thumbnail: video.thumbnail_url || undefined,
    });
  };

  if (isLoading) {
    return (
      <section className="py-3">
        <div className="px-4 mb-2">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="flex-shrink-0 rounded-xl w-36 h-24" />
          ))}
        </div>
      </section>
    );
  }

  if (!channels || channels.length === 0) return null;

  return (
    <section className="py-3">
      <div className="px-4 mb-2 flex items-center gap-2">
        <Youtube className="h-4 w-4 text-red-500" />
        <h2 className="font-semibold text-base text-foreground">{title}</h2>
      </div>

      {/* Channels Row */}
      <div
        className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {channels.map((channel) => (
          <div
            key={channel.id}
            onClick={() => handleChannelClick(channel)}
            className={cn(
              "flex-shrink-0 cursor-pointer active:scale-95 transition-all duration-200 w-36",
              selectedChannel?.id === channel.id && "ring-2 ring-red-500 rounded-xl"
            )}
          >
            {/* Channel Card */}
            <div className="relative h-24 rounded-xl overflow-hidden bg-muted">
              {/* Cover/Background */}
              {channel.cover_url ? (
                <img
                  src={channel.cover_url}
                  alt={channel.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : channel.thumbnail_url ? (
                <img
                  src={channel.thumbnail_url}
                  alt={channel.name}
                  className="w-full h-full object-cover blur-sm opacity-50"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700" />
              )}
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              
              {/* Channel Info */}
              <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center gap-2">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/30 flex-shrink-0">
                  {channel.thumbnail_url ? (
                    <img
                      src={channel.thumbnail_url}
                      alt={channel.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-red-600 flex items-center justify-center">
                      <Youtube className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                
                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium text-xs truncate">
                    {channel.name}
                  </h3>
                  <p className="text-white/60 text-[10px]">
                    {channel.video_count || 0} videos
                  </p>
                </div>
              </div>
              
              {/* Selection Indicator */}
              {selectedChannel?.id === channel.id && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <ChevronDown className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Channel Videos */}
      <AnimatePresence>
        {selectedChannel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 mx-4 p-3 bg-secondary/50 rounded-xl border border-border/30">
              {/* Channel Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    {selectedChannel.thumbnail_url ? (
                      <img
                        src={selectedChannel.thumbnail_url}
                        alt={selectedChannel.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-red-600 flex items-center justify-center">
                        <Youtube className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{selectedChannel.name}</h3>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {selectedChannel.subscriber_count && (
                        <>
                          <Users className="h-2.5 w-2.5" />
                          {selectedChannel.subscriber_count}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedChannel(null)}
                  className="p-1.5 rounded-full bg-secondary hover:bg-muted transition-colors"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>

              {/* Videos */}
              {videosLoading ? (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="flex-shrink-0 rounded-lg w-32 h-[4.5rem]" />
                  ))}
                </div>
              ) : channelVideos && channelVideos.length > 0 ? (
                <div
                  className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {channelVideos.map((video) => (
                    <div
                      key={video.id}
                      onClick={() => handleVideoClick(video)}
                      className="flex-shrink-0 cursor-pointer active:scale-95 transition-transform w-32"
                    >
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                        {video.thumbnail_url ? (
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-red-700">
                            <Youtube className="h-6 w-6 text-white" />
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-red-600/90 flex items-center justify-center">
                            <Play className="h-3 w-3 text-white fill-current" />
                          </div>
                        </div>
                        {video.duration && (
                          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] px-1 py-0.5 rounded">
                            {formatDuration(video.duration)}
                          </div>
                        )}
                      </div>
                      <h4 className="mt-1 text-[11px] font-medium text-foreground line-clamp-2">
                        {video.title}
                      </h4>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs text-center py-3">
                  No videos available
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
