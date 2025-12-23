import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Play, Youtube, X, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { YouTubeVideoPlayer } from "./YouTubeVideoPlayer";
import { motion, AnimatePresence } from "framer-motion";

interface HomeYouTubeRowProps {
  title?: string;
  maxItems?: number;
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal";
  onPlayVideo?: (videoId: string, title: string) => void;
}

interface YouTubeChannel {
  id: string;
  name: string;
  thumbnail_url: string | null;
  cover_url: string | null;
  subscriber_count: string | null;
  video_count: number | null;
  description: string | null;
}

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number | null;
}

interface YouTubePlaylist {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_count: number | null;
}

export function HomeYouTubeRow({ 
  title = "YouTube Channels", 
  maxItems = 10,
  cardStyle = "backdrop",
  onPlayVideo 
}: HomeYouTubeRowProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<YouTubeChannel | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);

  // Fetch YouTube channels that should show on desktop
  const { data: channels, isLoading } = useQuery({
    queryKey: ['home-youtube-channels-desktop'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('id, name, thumbnail_url, cover_url, subscriber_count, video_count, description')
        .eq('is_active', true)
        .eq('show_on_desktop', true)
        .order('display_order', { ascending: true })
        .limit(maxItems);
      
      if (error) throw error;
      return data as YouTubeChannel[];
    },
  });

  // Fetch playlists for selected channel
  const { data: playlists } = useQuery({
    queryKey: ['channel-playlists', selectedChannel?.id],
    queryFn: async () => {
      if (!selectedChannel) return [];
      const { data, error } = await supabase
        .from('youtube_playlists')
        .select('id, title, thumbnail_url, video_count')
        .eq('channel_id', selectedChannel.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as YouTubePlaylist[];
    },
    enabled: !!selectedChannel,
  });

  // Fetch videos for selected channel
  const { data: channelVideos, isLoading: videosLoading } = useQuery({
    queryKey: ['channel-videos', selectedChannel?.id],
    queryFn: async () => {
      if (!selectedChannel) return [];
      
      // Get playlists for the channel
      const { data: channelPlaylists, error: playlistsError } = await supabase
        .from('youtube_playlists')
        .select('id')
        .eq('channel_id', selectedChannel.id)
        .eq('is_active', true);

      if (playlistsError) throw playlistsError;
      if (!channelPlaylists || channelPlaylists.length === 0) return [];

      const playlistIds = channelPlaylists.map(p => p.id);

      // Get videos from those playlists
      const { data: videosData, error: videosError } = await supabase
        .from('youtube_videos')
        .select('*')
        .in('playlist_id', playlistIds)
        .order('published_at', { ascending: false })
        .limit(20);

      if (videosError) throw videosError;
      return videosData as YouTubeVideo[];
    },
    enabled: !!selectedChannel,
  });

  const scroll = (direction: "left" | "right", ref?: React.RefObject<HTMLDivElement>) => {
    const targetRef = ref || scrollRef;
    if (targetRef.current) {
      const scrollAmount = targetRef.current.clientWidth * 0.8;
      targetRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  const handleChannelClick = (channel: YouTubeChannel) => {
    if (selectedChannel?.id === channel.id) {
      setSelectedChannel(null);
    } else {
      setSelectedChannel(channel);
    }
  };

  const handleVideoClick = (video: YouTubeVideo) => {
    if (onPlayVideo) {
      onPlayVideo(video.video_id, video.title);
    } else {
      setPlayingVideo({ videoId: video.video_id, title: video.title });
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSubscribers = (count: string | null) => {
    if (!count) return "";
    return count;
  };

  if (isLoading) {
    return (
      <section className="py-4">
        <div className="px-4 md:px-12 mb-3">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-4 px-4 md:px-12">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="w-56 h-32 bg-muted rounded-xl animate-pulse flex-shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (!channels || channels.length === 0) return null;

  return (
    <>
      <section className="group/section relative py-4 transition-all duration-300 hover:z-10">
        <div className="px-4 md:px-12 mb-3 flex items-baseline gap-3">
          <h2 className="font-display text-lg md:text-xl lg:text-2xl text-foreground tracking-wide flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            {title}
          </h2>
          <span 
            onClick={() => navigate("/youtube")}
            className="text-brand text-sm font-medium opacity-0 group-hover/section:opacity-100 transition-opacity cursor-pointer hover:underline"
          >
            See All →
          </span>
        </div>

        {/* Channels Row */}
        <div className="relative">
          <button
            onClick={() => scroll("left")}
            className={cn(
              "absolute left-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center",
              "bg-gradient-to-r from-background via-background/90 to-transparent",
              "transition-all duration-300",
              showLeftArrow ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-secondary hover:scale-110 transition-all">
              <ChevronLeft className="h-6 w-6" />
            </div>
          </button>

          <button
            onClick={() => scroll("right")}
            className={cn(
              "absolute right-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center",
              "bg-gradient-to-l from-background via-background/90 to-transparent",
              "transition-all duration-300",
              showRightArrow ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-secondary hover:scale-110 transition-all">
              <ChevronRight className="h-6 w-6" />
            </div>
          </button>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-2 scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {channels.map(channel => (
              <div
                key={channel.id}
                onClick={() => handleChannelClick(channel)}
                className={cn(
                  "flex-shrink-0 cursor-pointer group relative w-56 md:w-64",
                  "transition-all duration-300",
                  selectedChannel?.id === channel.id && "ring-2 ring-red-500 rounded-xl"
                )}
              >
                {/* Channel Card */}
                <div className="relative h-32 md:h-36 rounded-xl overflow-hidden bg-muted">
                  {/* Cover Image */}
                  {channel.cover_url ? (
                    <img
                      src={channel.cover_url}
                      alt={channel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : channel.thumbnail_url ? (
                    <img
                      src={channel.thumbnail_url}
                      alt={channel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 blur-sm"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-700" />
                  )}
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  
                  {/* Channel Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end gap-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 flex-shrink-0">
                      {channel.thumbnail_url ? (
                        <img
                          src={channel.thumbnail_url}
                          alt={channel.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-red-600 flex items-center justify-center">
                          <Youtube className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </div>
                    
                    {/* Text Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-sm truncate">
                        {channel.name}
                      </h3>
                      <div className="flex items-center gap-2 text-white/70 text-xs">
                        {channel.subscriber_count && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {formatSubscribers(channel.subscriber_count)}
                          </span>
                        )}
                        {channel.video_count && (
                          <span>{channel.video_count} videos</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Selection Indicator */}
                  {selectedChannel?.id === channel.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                      <Play className="h-3 w-3 text-white fill-current" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expanded Channel Videos Panel */}
        <AnimatePresence>
          {selectedChannel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 mx-4 md:mx-12 p-4 bg-secondary/50 rounded-xl border border-border/50">
                {/* Channel Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden">
                      {selectedChannel.thumbnail_url ? (
                        <img
                          src={selectedChannel.thumbnail_url}
                          alt={selectedChannel.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-red-600 flex items-center justify-center">
                          <Youtube className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{selectedChannel.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedChannel.video_count} videos
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedChannel(null)}
                    className="p-2 rounded-full hover:bg-secondary transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Videos Grid */}
                {videosLoading ? (
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="w-48 h-28 bg-muted rounded-lg animate-pulse flex-shrink-0" />
                    ))}
                  </div>
                ) : channelVideos && channelVideos.length > 0 ? (
                  <div className="relative">
                    <div
                      ref={videoScrollRef}
                      className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      {channelVideos.map(video => (
                        <div
                          key={video.id}
                          onClick={() => handleVideoClick(video)}
                          className="flex-shrink-0 cursor-pointer group w-48 md:w-56"
                        >
                          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                            {video.thumbnail_url ? (
                              <img
                                src={video.thumbnail_url}
                                alt={video.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-red-700">
                                <Youtube className="h-8 w-8 text-white" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center">
                                <Play className="h-5 w-5 text-white fill-current" />
                              </div>
                            </div>
                            {video.duration && (
                              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                                {formatDuration(video.duration)}
                              </div>
                            )}
                          </div>
                          <h4 className="mt-2 text-sm font-medium text-foreground line-clamp-2 group-hover:text-red-500 transition-colors">
                            {video.title}
                          </h4>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No videos available for this channel
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {playingVideo && (
        <YouTubeVideoPlayer
          videoId={playingVideo.videoId}
          title={playingVideo.title}
          onClose={() => setPlayingVideo(null)}
          autoplay
        />
      )}
    </>
  );
}
