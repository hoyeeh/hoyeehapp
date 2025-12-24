import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Youtube, Search, Loader2, CheckCircle, ExternalLink, AlertCircle } from "lucide-react";
import { useImportFromYouTube, useCreatorImportedContent } from "@/hooks/useCreatorSocial";
import { toast } from "sonner";

interface YouTubeImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
}

export function YouTubeImportModal({ open, onOpenChange, creatorId }: YouTubeImportModalProps) {
  const [channelUrl, setChannelUrl] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const { data: importedContent = [] } = useCreatorImportedContent(creatorId);
  const importMutation = useImportFromYouTube();

  const importedVideoIds = new Set(
    importedContent
      .filter((c: any) => c.platform === 'youtube')
      .map((c: any) => c.platform_content_id)
  );

  const extractChannelId = (url: string): string | null => {
    // Handle various YouTube channel URL formats
    const patterns = [
      /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/@([a-zA-Z0-9_-]+)/,
      /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    // If it looks like a channel ID directly
    if (/^UC[a-zA-Z0-9_-]{22}$/.test(url)) {
      return url;
    }

    // If it looks like a handle
    if (/^@?[a-zA-Z0-9_-]+$/.test(url)) {
      return url.replace('@', '');
    }

    return null;
  };

  const handleSearch = async () => {
    const channelId = extractChannelId(channelUrl.trim());
    if (!channelId) {
      setSearchError("Please enter a valid YouTube channel URL or ID");
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setSearchResults([]);

    try {
      const response = await fetch(`/api/youtube-api?channelId=${encodeURIComponent(channelId)}&type=videos`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch videos");
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setSearchResults(data.videos || []);
      
      if (data.videos?.length === 0) {
        setSearchError("No videos found for this channel");
      }
    } catch (error: any) {
      console.error("YouTube search error:", error);
      setSearchError(error.message || "Failed to search YouTube. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const toggleVideoSelection = (videoId: string) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const toggleSelectAll = () => {
    const availableVideos = searchResults.filter(v => !importedVideoIds.has(v.id));
    if (selectedVideos.size === availableVideos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(availableVideos.map(v => v.id)));
    }
  };

  const handleImport = async () => {
    if (selectedVideos.size === 0) {
      toast.error("Please select at least one video to import");
      return;
    }

    const videosToImport = searchResults
      .filter(v => selectedVideos.has(v.id))
      .map(v => ({
        platform_content_id: v.id,
        title: v.title,
        description: v.description,
        thumbnail_url: v.thumbnail,
        video_url: `https://www.youtube.com/watch?v=${v.id}`,
        duration: v.duration,
        view_count: v.viewCount,
        original_published_at: v.publishedAt,
      }));

    try {
      await importMutation.mutateAsync({
        creatorId,
        platform: 'youtube',
        videos: videosToImport,
      });
      
      toast.success(`Successfully imported ${videosToImport.length} videos`);
      setSelectedVideos(new Set());
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to import videos");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const availableVideos = searchResults.filter(v => !importedVideoIds.has(v.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            Import from YouTube
          </DialogTitle>
          <DialogDescription>
            Enter your YouTube channel URL to import your videos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Enter YouTube channel URL (e.g., youtube.com/@channel)"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !channelUrl.trim()}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {searchError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {searchError}
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedVideos.size === availableVideos.length && availableVideos.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Label className="text-sm">
                    Select All ({availableVideos.length} available)
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedVideos.size} selected
                </p>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <div className="p-2 space-y-2">
                  {searchResults.map((video) => {
                    const isImported = importedVideoIds.has(video.id);
                    const isSelected = selectedVideos.has(video.id);

                    return (
                      <Card
                        key={video.id}
                        className={`cursor-pointer transition-colors ${
                          isImported 
                            ? 'opacity-50 cursor-not-allowed' 
                            : isSelected 
                              ? 'border-primary bg-primary/5' 
                              : 'hover:bg-secondary/50'
                        }`}
                        onClick={() => !isImported && toggleVideoSelection(video.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex gap-3">
                            <div className="relative w-32 h-20 rounded overflow-hidden bg-muted flex-shrink-0">
                              <img
                                src={video.thumbnail}
                                alt={video.title}
                                className="w-full h-full object-cover"
                              />
                              {video.duration && (
                                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                                  {formatDuration(video.duration)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                                {isImported ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                ) : (
                                  <Checkbox
                                    checked={isSelected}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleVideoSelection(video.id)}
                                  />
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>{formatViews(video.viewCount || 0)} views</span>
                                <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                              </div>
                              {isImported && (
                                <span className="text-xs text-green-600 mt-1 inline-block">
                                  Already imported
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedVideos.size === 0 || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Youtube className="h-4 w-4 mr-2" />
                Import {selectedVideos.size} Video{selectedVideos.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
