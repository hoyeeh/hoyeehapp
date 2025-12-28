import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { 
  Youtube, Plus, Trash2, RefreshCw, ExternalLink, 
  Play, List, Eye, Clock, ChevronRight, Search, Image as ImageIcon,
  Smartphone, Monitor, Baby, Zap, CheckSquare
} from "lucide-react";
import { YouTubeBannerManagement } from "./YouTubeBannerManagement";

interface YouTubeChannel {
  id: string;
  name: string;
  channel_id: string;
  description: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  subscriber_count: string | null;
  video_count: number;
  is_active: boolean;
  display_order: number;
  is_kids_friendly: boolean;
  show_on_mobile: boolean;
  show_on_desktop: boolean;
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
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set());
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // Fetch unsynced playlist count
  useEffect(() => {
    const fetchUnsyncedCount = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('youtube-auto-sync', {
          body: { action: 'get-unsynced-count' },
        });
        if (!error && data) {
          setUnsyncedCount(data.unsyncedCount || 0);
        }
      } catch (err) {
        console.error('Error fetching unsynced count:', err);
      }
    };
    fetchUnsyncedCount();
  }, []);

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
      queryClient.invalidateQueries({ queryKey: ['kids-youtube-videos'] });
      // Update unsynced count
      setUnsyncedCount(prev => Math.max(0, prev - 1));
    } catch (error: any) {
      toast.error(error.message || "Failed to sync videos");
    } finally {
      setSyncingPlaylistId(null);
    }
  };

  // Bulk sync selected playlists
  const bulkSyncPlaylists = async () => {
    if (selectedPlaylistIds.size === 0) {
      toast.error("Select at least one playlist to sync");
      return;
    }
    
    setIsBulkSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-auto-sync', {
        body: { 
          action: 'bulk-sync',
          playlistIds: Array.from(selectedPlaylistIds),
        },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      toast.success(`Synced ${data.playlistsSynced} playlists with ${data.totalVideos} videos`);
      queryClient.invalidateQueries({ queryKey: ['youtube-videos'] });
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] });
      queryClient.invalidateQueries({ queryKey: ['kids-youtube-videos'] });
      setSelectedPlaylistIds(new Set());
      setUnsyncedCount(prev => Math.max(0, prev - data.playlistsSynced));
    } catch (error: any) {
      toast.error(error.message || "Failed to bulk sync playlists");
    } finally {
      setIsBulkSyncing(false);
    }
  };

  // Auto-sync unsynced playlists
  const autoSyncUnsynced = async () => {
    setIsAutoSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-auto-sync', {
        body: { 
          action: 'auto-sync-unsynced',
          limit: 10,
        },
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      if (data.playlistsSynced === 0) {
        toast.info("All playlists are already synced!");
      } else {
        toast.success(`Auto-synced ${data.playlistsSynced} playlists with ${data.totalVideos} videos`);
      }
      queryClient.invalidateQueries({ queryKey: ['youtube-videos'] });
      queryClient.invalidateQueries({ queryKey: ['youtube-playlists'] });
      queryClient.invalidateQueries({ queryKey: ['kids-youtube-videos'] });
      setUnsyncedCount(prev => Math.max(0, prev - data.playlistsSynced));
    } catch (error: any) {
      toast.error(error.message || "Failed to auto-sync playlists");
    } finally {
      setIsAutoSyncing(false);
    }
  };

  // Toggle playlist selection
  const togglePlaylistSelection = (playlistId: string) => {
    setSelectedPlaylistIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playlistId)) {
        newSet.delete(playlistId);
      } else {
        newSet.add(playlistId);
      }
      return newSet;
    });
  };

  // Select all playlists in current view
  const selectAllPlaylists = () => {
    if (selectedPlaylistIds.size === playlists.length) {
      setSelectedPlaylistIds(new Set());
    } else {
      setSelectedPlaylistIds(new Set(playlists.map(p => p.id)));
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
    return <LoadingSpinner text="Loading channels..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display flex items-center gap-2">
            <Youtube className="h-6 w-6 text-red-500" />
            Channels
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage channels and playlists for in-app viewing
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Auto-sync button */}
          {unsyncedCount > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={autoSyncUnsynced}
              disabled={isAutoSyncing}
            >
              {isAutoSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Auto-Sync ({unsyncedCount} unsynced)
            </Button>
          )}
          
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
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannel === channel.id}
                  onSelect={() => {
                    setSelectedChannel(channel.id);
                    setSelectedPlaylist(null);
                  }}
                  onToggle={(checked) => toggleChannel.mutate({ id: channel.id, is_active: checked })}
                  onSync={() => syncPlaylists(channel)}
                  onDelete={() => {
                    if (confirm('Delete this channel and all its playlists?')) {
                      deleteChannel.mutate(channel.id);
                    }
                  }}
                  isSyncing={syncingChannelId === channel.id}
                  formatCount={formatCount}
                  queryClient={queryClient}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Playlists List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <List className="h-4 w-4" />
                Playlists
                {playlists.length > 0 && (
                  <Badge variant="secondary">{playlists.length}</Badge>
                )}
              </CardTitle>
              {playlists.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={selectAllPlaylists}
                  >
                    <CheckSquare className="h-3 w-3" />
                    {selectedPlaylistIds.size === playlists.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  {selectedPlaylistIds.size > 0 && (
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={bulkSyncPlaylists}
                      disabled={isBulkSyncing}
                    >
                      {isBulkSyncing ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Sync ({selectedPlaylistIds.size})
                    </Button>
                  )}
                </div>
              )}
            </div>
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
                      : selectedPlaylistIds.has(playlist.id)
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedPlaylist(playlist.id)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedPlaylistIds.has(playlist.id)}
                      onCheckedChange={() => togglePlaylistSelection(playlist.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
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
                      {playlist.video_count === 0 && (
                        <Badge variant="outline" className="text-xs mt-1 text-amber-600 border-amber-600">
                          Not synced
                        </Badge>
                      )}
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

      {/* Banner Management Section */}
      <YouTubeBannerManagement />
    </div>
  );
};

// Channel Card Component with Cover URL editing and visibility toggles
interface ChannelCardProps {
  channel: YouTubeChannel;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: (checked: boolean) => void;
  onSync: () => void;
  onDelete: () => void;
  isSyncing: boolean;
  formatCount: (count: number | string | null) => string;
  queryClient: ReturnType<typeof useQueryClient>;
}

function ChannelCard({ 
  channel, 
  isSelected, 
  onSelect, 
  onToggle, 
  onSync, 
  onDelete, 
  isSyncing, 
  formatCount,
  queryClient 
}: ChannelCardProps) {
  const [editCoverOpen, setEditCoverOpen] = useState(false);
  const [coverUrl, setCoverUrl] = useState(channel.cover_url || "");
  const [isSaving, setIsSaving] = useState(false);

  const saveCoverUrl = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('youtube_channels')
        .update({ cover_url: coverUrl || null })
        .eq('id', channel.id);
      
      if (error) throw error;
      
      toast.success("Cover image updated");
      queryClient.invalidateQueries({ queryKey: ['youtube-channels'] });
      setEditCoverOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update cover");
    } finally {
      setIsSaving(false);
    }
  };

  const updateVisibility = async (field: 'show_on_mobile' | 'show_on_desktop' | 'is_kids_friendly', value: boolean) => {
    try {
      const { error } = await supabase
        .from('youtube_channels')
        .update({ [field]: value })
        .eq('id', channel.id);
      
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['youtube-channels'] });
      toast.success("Visibility updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update visibility");
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-primary/50'
      }`}
      onClick={onSelect}
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
      
      {/* Visibility Toggles */}
      <div className="mt-3 pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Visibility</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateVisibility('show_on_mobile', !channel.show_on_mobile);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
              channel.show_on_mobile 
                ? 'bg-primary/10 border-primary text-primary' 
                : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span className="text-[10px] font-medium">Mobile</span>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateVisibility('show_on_desktop', !channel.show_on_desktop);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
              channel.show_on_desktop 
                ? 'bg-primary/10 border-primary text-primary' 
                : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span className="text-[10px] font-medium">Desktop</span>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateVisibility('is_kids_friendly', !channel.is_kids_friendly);
            }}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
              channel.is_kids_friendly 
                ? 'bg-green-500/10 border-green-500 text-green-500' 
                : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            <Baby className="h-4 w-4" />
            <span className="text-[10px] font-medium">Kids</span>
          </button>
        </div>
      </div>
      
      {/* Cover URL indicator */}
      <div className="mt-2 flex items-center gap-2">
        <Dialog open={editCoverOpen} onOpenChange={setEditCoverOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ImageIcon className="h-3 w-3" />
              {channel.cover_url ? "Edit Cover" : "Add Cover"}
            </Button>
          </DialogTrigger>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Channel Cover Image</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Cover Image URL</label>
                <Input
                  placeholder="https://example.com/cover.jpg"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This image will be used in the hero carousel on the YouTube page
                </p>
              </div>
              
              {coverUrl && (
                <div className="aspect-video bg-secondary rounded-lg overflow-hidden">
                  <img 
                    src={coverUrl} 
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  onClick={saveCoverUrl}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? <LoadingSpinner size="sm" /> : "Save Cover"}
                </Button>
                {channel.cover_url && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setCoverUrl("");
                      saveCoverUrl();
                    }}
                    disabled={isSaving}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {channel.cover_url && (
          <span className="text-xs text-green-500">✓ Has cover</span>
        )}
      </div>
      
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <Switch
            checked={channel.is_active}
            onCheckedChange={onToggle}
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
              onSync();
            }}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
