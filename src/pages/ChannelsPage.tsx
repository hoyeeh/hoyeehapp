import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sidebar } from "@/components/Sidebar";
import { MobileHeader, MobileBottomNav } from "@/components/mobile";
import { 
  useChannelSubscriptions, 
  useToggleChannelSubscription,
  useSubscribedChannels 
} from "@/hooks/useChannelSubscriptions";
import { useMobileYouTubePlayer } from "@/contexts/MobileYouTubePlayerContext";
import { YouTubeVideoPlayer } from "@/components/YouTubeVideoPlayer";
import { 
  Youtube, Search, Filter, Bell, BellOff, Users, 
  Play, Grid, List, ChevronRight, Star, TrendingUp
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface YouTubeChannel {
  id: string;
  name: string;
  channel_id: string;
  description: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  subscriber_count: string | null;
  video_count: number | null;
  is_kids_friendly: boolean;
}

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number | null;
  published_at: string | null;
}

export default function ChannelsPage() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: profile } = useProfile();
  const isMobile = useIsMobile();
  const { openPlayer: openMobilePlayer } = useMobileYouTubePlayer();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "subscribed" | "kids">("all");
  const [selectedChannel, setSelectedChannel] = useState<YouTubeChannel | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{ videoId: string; title: string } | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: subscriptions = [] } = useChannelSubscriptions();
  const { data: subscribedChannels = [] } = useSubscribedChannels();
  const toggleSubscription = useToggleChannelSubscription();

  // Fetch all channels
  const { data: allChannels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["all-youtube-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_channels")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      return data as YouTubeChannel[];
    },
  });

  // Fetch videos for selected channel
  const { data: channelVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: ["channel-detail-videos", selectedChannel?.id],
    queryFn: async () => {
      if (!selectedChannel) return [];

      const { data: playlists } = await supabase
        .from("youtube_playlists")
        .select("id")
        .eq("channel_id", selectedChannel.id)
        .eq("is_active", true);

      if (!playlists?.length) return [];

      const { data: videos, error } = await supabase
        .from("youtube_videos")
        .select("*")
        .in("playlist_id", playlists.map((p) => p.id))
        .order("published_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return videos as YouTubeVideo[];
    },
    enabled: !!selectedChannel,
  });

  // Filter channels based on search and active filter
  const filteredChannels = useMemo(() => {
    let channels = allChannels;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (activeFilter === "subscribed") {
      const subscribedIds = subscriptions.map((s) => s.channel_id);
      channels = channels.filter((c) => subscribedIds.includes(c.id));
    } else if (activeFilter === "kids") {
      channels = channels.filter((c) => c.is_kids_friendly);
    }

    return channels;
  }, [allChannels, searchQuery, activeFilter, subscriptions]);

  const isSubscribed = (channelId: string) =>
    subscriptions.some((s) => s.channel_id === channelId);

  const handlePlayVideo = (videoId: string, title: string) => {
    if (isMobile) {
      openMobilePlayer({ videoId, title });
    } else {
      setPlayingVideo({ videoId, title });
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const content = (
    <div className="flex-1 overflow-y-auto">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-primary/20 via-background to-background py-8 md:py-12 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Youtube className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Channels</h1>
              <p className="text-muted-foreground text-sm">
                Discover and subscribe to your favorite creators
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border-border/50"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("all")}
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                All
              </Button>
              <Button
                variant={activeFilter === "subscribed" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("subscribed")}
                disabled={!user}
              >
                <Star className="h-4 w-4 mr-1" />
                Subscribed
              </Button>
              <Button
                variant={activeFilter === "kids" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("kids")}
              >
                Kids
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="hidden md:flex"
              >
                {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Subscribed Channels Quick Access */}
      {user && subscribedChannels.length > 0 && activeFilter !== "subscribed" && (
        <div className="px-4 md:px-8 py-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Your Subscriptions
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilter("subscribed")}
              className="text-primary"
            >
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {subscribedChannels.slice(0, 8).map((sub: any) => (
              <button
                key={sub.id}
                onClick={() => setSelectedChannel(sub.youtube_channels)}
                className="flex-shrink-0 flex flex-col items-center gap-2 group"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/50 group-hover:border-primary transition-colors">
                  {sub.youtube_channels?.thumbnail_url ? (
                    <img
                      src={sub.youtube_channels.thumbnail_url}
                      alt={sub.youtube_channels.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                      <Youtube className="h-6 w-6 text-primary" />
                    </div>
                  )}
                </div>
                <span className="text-xs text-foreground truncate max-w-16 text-center">
                  {sub.youtube_channels?.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Channels Grid/List */}
      <div className="px-4 md:px-8 py-6">
        {channelsLoading ? (
          <div className={cn(
            viewMode === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
              : "space-y-4"
          )}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className={cn(
                viewMode === "grid" ? "h-64 rounded-xl" : "h-24 rounded-lg"
              )} />
            ))}
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="text-center py-16">
            <Youtube className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {searchQuery
                ? "No channels match your search"
                : activeFilter === "subscribed"
                ? "You haven't subscribed to any channels yet"
                : "No channels available"}
            </p>
          </div>
        ) : (
          <div className={cn(
            viewMode === "grid" 
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
              : "space-y-4"
          )}>
            {filteredChannels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                isSubscribed={isSubscribed(channel.id)}
                onSubscribe={() =>
                  toggleSubscription.mutate({
                    channelId: channel.id,
                    isSubscribed: isSubscribed(channel.id),
                  })
                }
                onSelect={() => setSelectedChannel(channel)}
                viewMode={viewMode}
                isLoggedIn={!!user}
              />
            ))}
          </div>
        )}
      </div>

      {/* Channel Detail Panel */}
      <AnimatePresence>
        {selectedChannel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center"
            onClick={() => setSelectedChannel(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-background w-full md:w-[90%] md:max-w-4xl max-h-[85vh] md:max-h-[80vh] rounded-t-2xl md:rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Channel Header */}
              <div className="relative h-32 md:h-48">
                {selectedChannel.cover_url ? (
                  <img
                    src={selectedChannel.cover_url}
                    alt={selectedChannel.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-primary/30 to-primary/10" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                
                <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-background shadow-lg flex-shrink-0">
                    {selectedChannel.thumbnail_url ? (
                      <img
                        src={selectedChannel.thumbnail_url}
                        alt={selectedChannel.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                        <Youtube className="h-8 w-8 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-foreground truncate">
                      {selectedChannel.name}
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {selectedChannel.subscriber_count && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {selectedChannel.subscriber_count}
                        </span>
                      )}
                      <span>{selectedChannel.video_count || 0} videos</span>
                    </div>
                  </div>
                  {user && (
                    <Button
                      variant={isSubscribed(selectedChannel.id) ? "outline" : "default"}
                      size="sm"
                      onClick={() =>
                        toggleSubscription.mutate({
                          channelId: selectedChannel.id,
                          isSubscribed: isSubscribed(selectedChannel.id),
                        })
                      }
                      disabled={toggleSubscription.isPending}
                    >
                      {isSubscribed(selectedChannel.id) ? (
                        <>
                          <BellOff className="h-4 w-4 mr-1" />
                          Subscribed
                        </>
                      ) : (
                        <>
                          <Bell className="h-4 w-4 mr-1" />
                          Subscribe
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Channel Description */}
              {selectedChannel.description && (
                <div className="px-4 py-3 border-b border-border/50">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {selectedChannel.description}
                  </p>
                </div>
              )}

              {/* Videos */}
              <div className="p-4 overflow-y-auto max-h-[40vh]">
                <h3 className="font-semibold text-foreground mb-3">Latest Videos</h3>
                {videosLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton key={i} className="aspect-video rounded-lg" />
                    ))}
                  </div>
                ) : channelVideos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No videos available
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {channelVideos.map((video) => (
                      <button
                        key={video.id}
                        onClick={() => handlePlayVideo(video.video_id, video.title)}
                        className="group text-left"
                      >
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt={video.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Youtube className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                              <Play className="h-4 w-4 text-primary-foreground fill-current" />
                            </div>
                          </div>
                          {video.duration && (
                            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                              {formatDuration(video.duration)}
                            </div>
                          )}
                        </div>
                        <h4 className="mt-2 text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                          {video.title}
                        </h4>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Close button */}
              <div className="p-4 border-t border-border/50">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSelectedChannel(null)}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Player */}
      {playingVideo && (
        <YouTubeVideoPlayer
          videoId={playingVideo.videoId}
          title={playingVideo.title}
          onClose={() => setPlayingVideo(null)}
          autoplay
        />
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <MobileHeader />
        {content}
        <MobileBottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        currentView="home"
        onNavigate={(view) => navigate(view === "home" ? "/" : `/${view}`)}
        onLogout={handleLogout}
        userName={profile?.display_name}
      />
      <main className="ml-16 md:ml-64 flex-1">{content}</main>
    </div>
  );
}

// Channel Card Component
function ChannelCard({
  channel,
  isSubscribed,
  onSubscribe,
  onSelect,
  viewMode,
  isLoggedIn,
}: {
  channel: YouTubeChannel;
  isSubscribed: boolean;
  onSubscribe: () => void;
  onSelect: () => void;
  viewMode: "grid" | "list";
  isLoggedIn: boolean;
}) {
  if (viewMode === "list") {
    return (
      <div
        onClick={onSelect}
        className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer border border-border/30"
      >
        <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
          {channel.thumbnail_url ? (
            <img
              src={channel.thumbnail_url}
              alt={channel.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary/20 flex items-center justify-center">
              <Youtube className="h-6 w-6 text-primary" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{channel.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {channel.description || "No description"}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {channel.subscriber_count && (
              <span>{channel.subscriber_count} subscribers</span>
            )}
            <span>{channel.video_count || 0} videos</span>
          </div>
        </div>
        {isLoggedIn && (
          <Button
            variant={isSubscribed ? "outline" : "default"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSubscribe();
            }}
          >
            {isSubscribed ? "Subscribed" : "Subscribe"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className="group bg-secondary/30 rounded-xl overflow-hidden hover:bg-secondary/50 transition-colors cursor-pointer border border-border/30"
    >
      {/* Cover Image */}
      <div className="relative h-24">
        {channel.cover_url ? (
          <img
            src={channel.cover_url}
            alt={channel.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/20 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        
        {/* Avatar */}
        <div className="absolute -bottom-6 left-4 w-14 h-14 rounded-full overflow-hidden border-4 border-background shadow-lg">
          {channel.thumbnail_url ? (
            <img
              src={channel.thumbnail_url}
              alt={channel.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary/20 flex items-center justify-center">
              <Youtube className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>

        {channel.is_kids_friendly && (
          <Badge className="absolute top-2 right-2 bg-cyan-500/80">Kids</Badge>
        )}
      </div>

      {/* Info */}
      <div className="pt-8 pb-4 px-4">
        <h3 className="font-semibold text-foreground truncate">{channel.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 h-8">
          {channel.description || "No description available"}
        </p>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{channel.subscriber_count || "0"}</span>
            <span>•</span>
            <span>{channel.video_count || 0} videos</span>
          </div>
        </div>
        {isLoggedIn && (
          <Button
            variant={isSubscribed ? "outline" : "default"}
            size="sm"
            className="w-full mt-3"
            onClick={(e) => {
              e.stopPropagation();
              onSubscribe();
            }}
          >
            {isSubscribed ? (
              <>
                <Bell className="h-4 w-4 mr-1" />
                Subscribed
              </>
            ) : (
              "Subscribe"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
