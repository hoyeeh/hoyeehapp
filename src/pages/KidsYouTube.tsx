import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { KidsInterface } from "@/components/KidsInterface";
import { KidsYouTubePlayer } from "@/components/kids/KidsYouTubePlayer";
import { Youtube, Play, Sparkles, Star, Heart, Music, Gamepad2, BookOpen, Palette, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useMobileYouTubePlayer } from "@/contexts/MobileYouTubePlayerContext";

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number;
  channelId?: string;
}

interface KidsCategory {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
}

interface KidsChannel {
  id: string;
  name: string;
  thumbnail_url: string | null;
  kids_category_id: string | null;
  video_count: number;
}

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getCategoryIcon = (slug: string) => {
  switch (slug) {
    case "music": return Music;
    case "games": return Gamepad2;
    case "learning": return BookOpen;
    case "art": return Palette;
    case "favorites": return Heart;
    default: return Sparkles;
  }
};

const getCategoryGradient = (color: string) => {
  const gradients: Record<string, string> = {
    "#FF6B6B": "from-red-500 to-rose-600",
    "#4ECDC4": "from-teal-400 to-cyan-500",
    "#45B7D1": "from-sky-400 to-blue-500",
    "#96CEB4": "from-emerald-400 to-green-500",
    "#FFEAA7": "from-amber-400 to-yellow-500",
    "#DDA0DD": "from-purple-400 to-fuchsia-500",
    "#98D8C8": "from-teal-300 to-emerald-400",
    "#F7DC6F": "from-yellow-400 to-amber-500",
  };
  return gradients[color] || "from-violet-500 to-purple-600";
};

const getChannelGradient = (index: number) => {
  const gradients = [
    "from-red-500 to-rose-600",
    "from-violet-500 to-purple-600",
    "from-sky-400 to-blue-500",
    "from-emerald-400 to-green-500",
    "from-amber-400 to-yellow-500",
    "from-pink-500 to-rose-500",
    "from-teal-400 to-cyan-500",
    "from-orange-400 to-red-500",
  ];
  return gradients[index % gradients.length];
};

// Kids Channels Row Component
const KidsChannelsRow = ({ 
  channels, 
  selectedChannel,
  onSelectChannel 
}: { 
  channels: KidsChannel[]; 
  selectedChannel: string | null;
  onSelectChannel: (channelId: string | null) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (channels.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-4 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-fuchsia-500/20 rounded-2xl p-4 md:p-6 border border-violet-500/20"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Youtube className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">Our Channels</h2>
      </div>

      <div className="relative group">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide px-1"
        >
          {/* All Channels Option */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => onSelectChannel(null)}
            className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
              selectedChannel === null 
                ? "bg-white/20 ring-2 ring-white/50" 
                : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center border-2 border-white/20">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <span className="text-xs md:text-sm font-medium text-white/80 text-center max-w-[80px] truncate">
              All Videos
            </span>
          </motion.button>

          {channels.map((channel, index) => (
            <motion.button
              key={channel.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelectChannel(channel.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
                selectedChannel === channel.id 
                  ? "bg-white/20 ring-2 ring-white/50" 
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 ${
                selectedChannel === channel.id ? "border-white" : "border-white/30"
              }`}>
                {channel.thumbnail_url ? (
                  <img
                    src={channel.thumbnail_url}
                    alt={channel.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${getChannelGradient(index)} flex items-center justify-center`}>
                    <Youtube className="h-8 w-8 text-white" />
                  </div>
                )}
              </div>
              <span className="text-xs md:text-sm font-medium text-white/80 text-center max-w-[80px] truncate">
                {channel.name}
              </span>
              <span className="text-[10px] text-white/50">
                {channel.video_count} videos
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.section>
  );
};

// Video Row Component
const VideoRow = ({ 
  videos, 
  onPlayVideo, 
  categoryName,
  channels 
}: { 
  videos: YouTubeVideo[]; 
  onPlayVideo: (videoId: string, title: string) => void;
  categoryName: string;
  channels?: KidsChannel[];
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const getChannelName = (channelId?: string) => {
    if (!channelId || !channels) return null;
    return channels.find(c => c.id === channelId)?.name;
  };

  if (videos.length === 0) return null;

  return (
    <div className="relative group">
      <button
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      
      <button
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide px-1"
      >
        {videos.map((video, index) => {
          const channelName = getChannelName(video.channelId);
          return (
            <motion.button
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onPlayVideo(video.video_id, video.title)}
              className="flex-shrink-0 w-[200px] md:w-[240px] group/card"
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500/20 to-fuchsia-600/20">
                <img
                  src={video.thumbnail_url || `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
                  alt={video.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                  loading="lazy"
                />
                
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-xl">
                    <Play className="h-7 w-7 text-[#0A0A0F] ml-1" fill="currentColor" />
                  </div>
                </div>

                {video.duration && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/80 text-white text-xs font-medium">
                    {formatDuration(video.duration)}
                  </div>
                )}
              </div>

              <p className="mt-2 text-sm font-medium text-white/80 line-clamp-2 text-left group-hover/card:text-white transition-colors">
                {video.title}
              </p>
              {channelName && (
                <p className="mt-1 text-xs text-white/50 text-left truncate">
                  {channelName}
                </p>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// Channel Videos Section
const ChannelVideosSection = ({
  channel,
  videos,
  onPlayVideo,
  index
}: {
  channel: KidsChannel;
  videos: YouTubeVideo[];
  onPlayVideo: (videoId: string, title: string) => void;
  index: number;
}) => {
  const gradient = getChannelGradient(index);
  const bgGradient = gradient.includes("red") ? "from-red-500/15 via-red-500/5 to-rose-500/15 border-red-500/20" :
                    gradient.includes("violet") ? "from-violet-500/15 via-violet-500/5 to-purple-500/15 border-violet-500/20" :
                    gradient.includes("sky") ? "from-sky-500/15 via-sky-500/5 to-blue-500/15 border-sky-500/20" :
                    gradient.includes("emerald") ? "from-emerald-500/15 via-emerald-500/5 to-green-500/15 border-emerald-500/20" :
                    gradient.includes("amber") ? "from-amber-500/15 via-amber-500/5 to-yellow-500/15 border-amber-500/20" :
                    gradient.includes("pink") ? "from-pink-500/15 via-pink-500/5 to-rose-500/15 border-pink-500/20" :
                    gradient.includes("teal") ? "from-teal-500/15 via-teal-500/5 to-cyan-500/15 border-teal-500/20" :
                    "from-orange-500/15 via-orange-500/5 to-red-500/15 border-orange-500/20";

  if (videos.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`space-y-4 bg-gradient-to-br ${bgGradient} rounded-2xl p-4 md:p-6 border`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 flex-shrink-0`}>
          {channel.thumbnail_url ? (
            <img
              src={channel.thumbnail_url}
              alt={channel.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <Youtube className="h-6 w-6 text-white" />
            </div>
          )}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">{channel.name}</h2>
          <p className="text-xs text-white/50">{videos.length} videos</p>
        </div>
      </div>
      <VideoRow videos={videos} onPlayVideo={onPlayVideo} categoryName={`channel-${channel.id}`} />
    </motion.section>
  );
};

const KidsYouTubeContent = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { currentProfile } = useProfileContext();
  const [youtubePlayer, setYoutubePlayer] = useState<{ videoId: string; title: string } | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const mobileYouTubePlayer = useMobileYouTubePlayer();

  // Fetch kids categories
  const { data: categories = [] } = useQuery({
    queryKey: ["kids-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as KidsCategory[];
    },
  });

  // Fetch kids-friendly channels
  const { data: kidsChannels = [] } = useQuery({
    queryKey: ["kids-youtube-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_channels")
        .select("id, name, thumbnail_url, kids_category_id, video_count")
        .eq("is_active", true)
        .eq("is_kids_friendly", true)
        .order("display_order");
      if (error) throw error;
      return data as KidsChannel[];
    },
  });

  // Fetch all kids-friendly YouTube videos with channel info
  const { data: allVideos = [], isLoading } = useQuery({
    queryKey: ["kids-youtube-all-enhanced"],
    queryFn: async () => {
      // Get kids-friendly channels
      const { data: channels, error: channelsError } = await supabase
        .from("youtube_channels")
        .select("id, kids_category_id")
        .eq("is_active", true)
        .eq("is_kids_friendly", true);

      if (channelsError) throw channelsError;
      if (!channels?.length) return [];

      // Get playlists from those channels
      const { data: playlists, error: playlistsError } = await supabase
        .from("youtube_playlists")
        .select("id, channel_id")
        .in("channel_id", channels.map((c) => c.id))
        .eq("is_active", true);

      if (playlistsError) throw playlistsError;
      if (!playlists?.length) return [];

      // Get videos from those playlists (increased limit)
      const { data: videosData, error: videosError } = await supabase
        .from("youtube_videos")
        .select("*, playlist:playlist_id(channel_id)")
        .in("playlist_id", playlists.map((p) => p.id))
        .order("created_at", { ascending: false })
        .limit(500);

      if (videosError) throw videosError;

      // Map videos with their category and channel
      return (videosData || []).map((video: any) => {
        const channelId = video.playlist?.channel_id;
        const channel = channels.find((c) => c.id === channelId);
        return {
          ...video,
          categoryId: channel?.kids_category_id,
          channelId: channelId,
        };
      });
    },
  });

  const handlePlayVideo = (videoId: string, title: string) => {
    if (isMobile) {
      mobileYouTubePlayer.openPlayer({
        videoId,
        title,
      });
    } else {
      setYoutubePlayer({ videoId, title });
    }
  };

  // Filter videos by selected channel
  const filteredVideos = selectedChannel 
    ? allVideos.filter((v: any) => v.channelId === selectedChannel)
    : allVideos;

  // Group videos by category
  const videosByCategory = categories.reduce((acc, category) => {
    acc[category.id] = filteredVideos.filter((v: any) => v.categoryId === category.id);
    return acc;
  }, {} as Record<string, YouTubeVideo[]>);

  // Group videos by channel
  const videosByChannel = kidsChannels.reduce((acc, channel) => {
    acc[channel.id] = allVideos.filter((v: any) => v.channelId === channel.id).slice(0, 30);
    return acc;
  }, {} as Record<string, YouTubeVideo[]>);

  // Get featured/all videos (no specific category)
  const featuredVideos = filteredVideos.slice(0, 25);

  if (!currentProfile?.is_kids) {
    navigate("/");
    return null;
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-10 pt-4">
        <div className="text-center py-8">
          <Skeleton className="w-20 h-20 mx-auto rounded-3xl bg-white/[0.04]" />
          <Skeleton className="w-48 h-8 mx-auto mt-4 bg-white/[0.04]" />
        </div>
        {/* Channels skeleton */}
        <div className="space-y-4 bg-white/[0.02] rounded-2xl p-4 md:p-6">
          <Skeleton className="w-40 h-6 bg-white/[0.04]" />
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="flex flex-col items-center gap-2">
                <Skeleton className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/[0.04]" />
                <Skeleton className="w-16 h-3 bg-white/[0.04]" />
              </div>
            ))}
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="w-40 h-6 bg-white/[0.04]" />
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map((j) => (
                <Skeleton key={j} className="w-[200px] aspect-video rounded-2xl bg-white/[0.04] flex-shrink-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (youtubePlayer) {
    return (
      <KidsYouTubePlayer
        videoId={youtubePlayer.videoId}
        title={youtubePlayer.title}
        onClose={() => setYoutubePlayer(null)}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8 pb-24 md:pb-12 pt-4">
      {/* Header */}
      <div className="text-center py-6 md:py-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-red-500/30 mb-4"
        >
          <Youtube className="h-10 w-10 text-white" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl md:text-4xl font-bold text-white tracking-[-0.02em]"
        >
          Just Kids
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-white/50 text-[15px] md:text-base mt-2 font-medium"
        >
          Fun videos just for you!
        </motion.p>

        {/* Free Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30"
        >
          <Star className="h-4 w-4 text-emerald-400" fill="currentColor" />
          <span className="text-sm font-semibold text-emerald-300">All Free to Watch!</span>
        </motion.div>
      </div>

      {/* Channels Section */}
      {kidsChannels.length > 0 && (
        <KidsChannelsRow 
          channels={kidsChannels} 
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
        />
      )}

      {/* Show channel-specific content when a channel is selected */}
      {selectedChannel ? (
        <>
          {/* Selected Channel Videos */}
          {filteredVideos.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-orange-500/20 rounded-2xl p-4 md:p-6 border border-amber-500/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">
                  {kidsChannels.find(c => c.id === selectedChannel)?.name} Videos
                </h2>
              </div>
              <VideoRow 
                videos={filteredVideos.slice(0, 50)} 
                onPlayVideo={handlePlayVideo} 
                categoryName="selected-channel" 
                channels={kidsChannels}
              />
            </motion.section>
          )}
        </>
      ) : (
        <>
          {/* Featured Section */}
          {featuredVideos.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="space-y-4 bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-orange-500/20 rounded-2xl p-4 md:p-6 border border-amber-500/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">Just For You</h2>
              </div>
              <VideoRow videos={featuredVideos} onPlayVideo={handlePlayVideo} categoryName="featured" channels={kidsChannels} />
            </motion.section>
          )}

          {/* Category Sections */}
          {categories.map((category) => {
            const categoryVideos = videosByCategory[category.id] || [];
            if (categoryVideos.length === 0) return null;

            const Icon = getCategoryIcon(category.slug);
            const gradient = getCategoryGradient(category.color);

            const bgGradient = gradient.includes("red") ? "from-red-500/20 via-red-500/10 to-rose-500/20 border-red-500/20" :
                              gradient.includes("teal") ? "from-teal-500/20 via-teal-500/10 to-cyan-500/20 border-teal-500/20" :
                              gradient.includes("sky") ? "from-sky-500/20 via-sky-500/10 to-blue-500/20 border-sky-500/20" :
                              gradient.includes("emerald") ? "from-emerald-500/20 via-emerald-500/10 to-green-500/20 border-emerald-500/20" :
                              gradient.includes("amber") ? "from-amber-500/20 via-amber-500/10 to-yellow-500/20 border-amber-500/20" :
                              gradient.includes("purple") ? "from-purple-500/20 via-purple-500/10 to-fuchsia-500/20 border-purple-500/20" :
                              gradient.includes("yellow") ? "from-yellow-500/20 via-yellow-500/10 to-amber-500/20 border-yellow-500/20" :
                              "from-violet-500/20 via-violet-500/10 to-purple-500/20 border-violet-500/20";

            return (
              <motion.section 
                key={category.id} 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`space-y-4 bg-gradient-to-br ${bgGradient} rounded-2xl p-4 md:p-6 border`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">
                    {category.name}
                  </h2>
                </div>
                <VideoRow videos={categoryVideos} onPlayVideo={handlePlayVideo} categoryName={category.slug} channels={kidsChannels} />
              </motion.section>
            );
          })}

          {/* Channel-Based Sections */}
          {kidsChannels.map((channel, index) => (
            <ChannelVideosSection
              key={channel.id}
              channel={channel}
              videos={videosByChannel[channel.id] || []}
              onPlayVideo={handlePlayVideo}
              index={index}
            />
          ))}
        </>
      )}

      {/* Empty State */}
      {allVideos.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mb-6 shadow-2xl shadow-red-500/30">
            <Youtube className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3 tracking-[-0.02em]">No Videos Yet</h2>
          <p className="text-[15px] text-white/50 font-medium">Check back soon for fun videos!</p>
        </div>
      )}
    </div>
  );
};

const KidsYouTube = () => {
  return (
    <KidsInterface>
      <KidsYouTubeContent />
    </KidsInterface>
  );
};

export default KidsYouTube;
