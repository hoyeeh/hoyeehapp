import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { 
  Youtube, Plus, Trash2, RefreshCw, ExternalLink, 
  Play, List, Eye, Clock, ChevronRight, Search
} from "lucide-react";

interface YouTubeChannel {
  id: string;
  name: string;
  channel_id: string;
  description: string | null;
  thumbnail_url: string | null;
  subscriber_count: string | null;
  video_count: number;
  is_active: boolean;
  display_order: number;
}

interface YouTubePlaylist {
  id: string;
  channel_id: string;
  playlist_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_count: number;
  is_active: boolean;
}

interface YouTubeVideo {
  id: string;
  playlist_id: string;
  video_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  view_count: number;
  published_at: string | null;
}

export const YouTubeChannelManagement = () => {
  const queryClient = useQueryClient();
  const [channelInput, setChannelInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<any>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [syncingChannelId, setSyncingChannelId] = useState<string | null>(null);
  const [syncingPlaylistId, setSyncingPlaylistId] = useState<string | null>(null);

  // Fetch channels
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['youtube-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as YouTubeChannel[];
    },
  });

  // Fetch playlists for selected channel
  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['youtube-playlists', selectedChannel],
    queryFn: async () => {
      if (!selectedChannel) return [];
      const { data, error } = await supabase
        .from('youtube_playlists')
        .select('*')
        .eq('channel_id', selectedChannel)
        .order('display_order');
      if (error) throw error;
      return data as YouTubePlaylist[];
    },
    enabled: !!selectedChannel,
  });

  // Fetch videos for selected playlist
  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['youtube-videos', selectedPlaylist],
    queryFn: async () => {
      if (!selectedPlaylist) return [];
      const { data, error } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('playlist_id', selectedPlaylist)
        .order('position');
      if (error) throw error;
      return data as YouTubeVideo[];
    },
    enabled: !!selectedPlaylist,
  });

  // Validate channel
  const validateChannel = async () => {
    if (!channelInput.trim()) {
      toast.error("Please enter a channel ID or URL");
      return;
    }
    
    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { action: 'validate-channel', channelId: channelInput },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setPreviewChannel(data);
      toast.success("Channel found!");
    } catch (error: any) {
      toast.error(error.message || "Failed to validate channel");
      setPreviewChannel(null);
    } finally {
      setIsValidating(false);
    }
  };

  // Add channel mutation
  const addChannel = useMutation({
    mutationFn: async () => {
      if (!previewChannel) throw new Error("No channel to add");
      
      const { error } = await supabase.from('youtube_channels').insert({
        name: previewChannel.title,
        channel_id: previewChannel.id,
        description: previewChannel.description,
        thumbnail_url: previewChannel.thumbnailUrl,
        subscriber_count: previewChannel.subscriberCount,
        video_count: previewChannel.videoCount,
        display_order: channels.length,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Channel added successfully");
      queryClient.invalidateQueries({ queryKey: ['youtube-channels'] });
      setAddDialogOpen(false);
      setChannelInput("");
      setPreviewChannel(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add channel");
    },
  });

  // Delete channel mutation
  const deleteChannel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('youtube_channels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Channel deleted");
      queryClient.invalidateQueries({ queryKey: ['youtube-channels'] });
      if (selectedChannel === selectedChannel) {
        setSelectedChannel(null);
        setSelectedPlaylist(null);
      }
    },
  });

  // Toggle channel active status
  const toggleChannel = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('youtube_channels')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-channels'] });
    },
  });

  // Toggle playlist active status
  const togglePlaylist = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('youtube_playlists')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] });
    },
  });

  // Sync playlists for a channel
  const syncPlaylists = async (channel: YouTubeChannel) => {
    setSyncingChannelId(channel.id);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { 
          action: 'sync-playlists', 
          channelId: channel.channel_id,
          dbChannelId: channel.id,
        },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      toast.success(`Synced ${data.count} playlists`);
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] });
    } catch (error: any) {
      toast.error(error.message || "Failed to sync playlists");
    } finally {
      setSyncingChannelId(null);
    }
  };

  // Sync videos for a playlist
  const syncVideos = async (playlist: YouTubePlaylist) => {
    setSyncingPlaylistId(playlist.id);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { 
          action: 'sync-videos', 
          playlistId: playlist.playlist_id,
          dbPlaylistId: playlist.id,
        },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      toast.success(`Synced ${data.count} videos`);
      queryClient.invalidateQueries({ queryKey: ['youtube-videos'] });
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] });
    } catch (error: any) {
      toast.error(error.message || "Failed to sync videos");
    } finally {
      setSyncingPlaylistId(null);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCount = (count: number | string | null) => {
    if (!count) return "0";
    const num = typeof count === 'string' ? parseInt(count) : count;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (channelsLoading) {
    return <LoadingSpinner text="Loading YouTube channels..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display flex items-center gap-2">
            <Youtube className="h-6 w-6 text-red-500" />
            YouTube Channels
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage YouTube channels and playlists for in-app viewing
          </p>
        </div>
        
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Channel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add YouTube Channel</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Channel ID, URL, or @handle"
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && validateChannel()}
                />
                <Button onClick={validateChannel} disabled={isValidating}>
                  {isValidating ? <LoadingSpinner size="sm" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              
              {previewChannel && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <img
                        src={previewChannel.thumbnailUrl}
                        alt={previewChannel.title}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{previewChannel.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {previewChannel.description}
                        </p>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{formatCount(previewChannel.subscriberCount)} subscribers</span>
                          <span>{formatCount(previewChannel.videoCount)} videos</span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      className="w-full mt-4" 
                      onClick={() => addChannel.mutate()}
                      disabled={addChannel.isPending}
                    >
                      {addChannel.isPending ? <LoadingSpinner size="sm" /> : "Add Channel"}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channels List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Channels ({channels.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {channels.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No channels added yet
              </p>
            ) : (
              channels.map((channel) => (
                <div
                  key={channel.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedChannel === channel.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setSelectedChannel(channel.id);
                    setSelectedPlaylist(null);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={channel.thumbnail_url || "/placeholder.svg"}
                      alt={channel.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate text-sm">{channel.name}</h4>
                        {!channel.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatCount(channel.subscriber_count)} subs
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={channel.is_active}
                        onCheckedChange={(checked) => 
                          toggleChannel.mutate({ id: channel.id, is_active: checked })
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-muted-foreground">Active</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          syncPlaylists(channel);
                        }}
                        disabled={syncingChannelId === channel.id}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingChannelId === channel.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this channel and all its playlists?')) {
                            deleteChannel.mutate(channel.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Playlists List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <List className="h-4 w-4" />
              Playlists
              {playlists.length > 0 && (
                <Badge variant="secondary">{playlists.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {!selectedChannel ? (
              <p className="text-center text-muted-foreground py-8">
                Select a channel to view playlists
              </p>
            ) : playlistsLoading ? (
              <LoadingSpinner text="Loading playlists..." />
            ) : playlists.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">No playlists synced</p>
                <Button
                  size="sm"
                  onClick={() => {
                    const channel = channels.find(c => c.id === selectedChannel);
                    if (channel) syncPlaylists(channel);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Playlists
                </Button>
              </div>
            ) : (
              playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPlaylist === playlist.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedPlaylist(playlist.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative w-20 aspect-video rounded overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={playlist.thumbnail_url || "/placeholder.svg"}
                        alt={playlist.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">
                        {playlist.video_count} videos
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">{playlist.title}</h4>
                      {!playlist.is_active && (
                        <Badge variant="secondary" className="text-xs mt-1">Inactive</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={playlist.is_active}
                        onCheckedChange={(checked) => 
                          togglePlaylist.mutate({ id: playlist.id, is_active: checked })
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-muted-foreground">Active</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        syncVideos(playlist);
                      }}
                      disabled={syncingPlaylistId === playlist.id}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncingPlaylistId === playlist.id ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Videos List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="h-4 w-4" />
              Videos
              {videos.length > 0 && (
                <Badge variant="secondary">{videos.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {!selectedPlaylist ? (
              <p className="text-center text-muted-foreground py-8">
                Select a playlist to view videos
              </p>
            ) : videosLoading ? (
              <LoadingSpinner text="Loading videos..." />
            ) : videos.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">No videos synced</p>
                <Button
                  size="sm"
                  onClick={() => {
                    const playlist = playlists.find(p => p.id === selectedPlaylist);
                    if (playlist) syncVideos(playlist);
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Videos
                </Button>
              </div>
            ) : (
              videos.map((video) => (
                <div
                  key={video.id}
                  className="p-2 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative w-24 aspect-video rounded overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={video.thumbnail_url || "/placeholder.svg"}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-xs line-clamp-2">{video.title}</h4>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-3 w-3" />
                          {formatCount(video.view_count)}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {formatDuration(video.duration)}
                        </span>
                      </div>
                    </div>
                    <a
                      href={`https://youtube.com/watch?v=${video.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
