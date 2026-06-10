import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllContent } from "@/lib/fetchAllContent";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Trash2, 
  Link2, 
  Copy, 
  FileVideo,
  Tv,
  Film,
  Loader2,
  Download,
  Upload,
  Merge,
  Eye,
  ExternalLink
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  video_url: string | null;
  thumbnail_url: string | null;
  year: number | null;
  genre: string | null;
  created_at: string | null;
  tmdb_id: number | null;
}

interface Episode {
  id: string;
  title: string;
  episode_number: number;
  video_url: string | null;
  season_id: string;
  season_number?: number;
  content_title?: string;
}

interface DuplicateGroup {
  key: string;
  title: string;
  contentType: string;
  items: ContentItem[];
}

export const ContentHealthDashboard = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedContent, setSelectedContent] = useState<Set<string>>(new Set());
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(new Set());
  const [selectedDuplicates, setSelectedDuplicates] = useState<Map<string, Set<string>>>(new Map());
  const [validatingUrls, setValidatingUrls] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [urlValidationResults, setUrlValidationResults] = useState<Map<string, boolean>>(new Map());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);
  const [editingUrls, setEditingUrls] = useState<Map<string, string>>(new Map());
  const [missingUrlFilter, setMissingUrlFilter] = useState<"all" | "movie" | "series">("all");
  // Fetch all content
  const { data: content = [], isLoading: contentLoading, refetch: refetchContent } = useQuery({
    queryKey: ["content-health-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, content_type, video_url, thumbnail_url, year, genre, created_at, tmdb_id")
        .order("title");
      if (error) throw error;
      return data as ContentItem[];
    },
  });

  // Fetch all episodes with season and content info
  const { data: episodes = [], isLoading: episodesLoading, refetch: refetchEpisodes } = useQuery({
    queryKey: ["content-health-episodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("episodes")
        .select(`
          id, title, episode_number, video_url, season_id,
          seasons:season_id (
            season_number,
            content:content_id (title)
          )
        `)
        .order("episode_number");
      if (error) throw error;
      return (data || []).map((ep: any) => ({
        id: ep.id,
        title: ep.title,
        episode_number: ep.episode_number,
        video_url: ep.video_url,
        season_id: ep.season_id,
        season_number: ep.seasons?.season_number,
        content_title: ep.seasons?.content?.title,
      })) as Episode[];
    },
  });

  // Calculate health metrics
  const healthMetrics = useMemo(() => {
    const contentWithoutUrl = content.filter(c => !c.video_url || c.video_url.trim() === "");
    const episodesWithoutUrl = episodes.filter(e => !e.video_url || e.video_url.trim() === "");
    
    // Find duplicates (same title + content_type)
    const titleMap = new Map<string, ContentItem[]>();
    content.forEach(item => {
      const key = `${item.title.toLowerCase().trim()}|${item.content_type}`;
      if (!titleMap.has(key)) {
        titleMap.set(key, []);
      }
      titleMap.get(key)!.push(item);
    });
    
    const duplicateGroups: DuplicateGroup[] = [];
    titleMap.forEach((items, key) => {
      if (items.length > 1) {
        const [title, contentType] = key.split("|");
        duplicateGroups.push({
          key,
          title: items[0].title,
          contentType,
          items,
        });
      }
    });

    return {
      totalContent: content.length,
      totalEpisodes: episodes.length,
      contentWithoutUrl,
      episodesWithoutUrl,
      duplicateGroups,
      duplicateCount: duplicateGroups.reduce((acc, g) => acc + g.items.length - 1, 0),
    };
  }, [content, episodes]);

  // Delete content mutation
  const deleteContentMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        // Delete related seasons and episodes first
        const { data: seasons } = await supabase
          .from("seasons")
          .select("id")
          .eq("content_id", id);
        
        if (seasons && seasons.length > 0) {
          for (const season of seasons) {
            await supabase.from("episodes").delete().eq("season_id", season.id);
          }
          await supabase.from("seasons").delete().eq("content_id", id);
        }

        // Delete from other related tables
        await supabase.from("watchlist").delete().eq("content_id", id);
        await supabase.from("watch_history").delete().eq("content_id", id);
        await supabase.from("reviews").delete().eq("content_id", id);
        await supabase.from("top_10").delete().eq("content_id", id);
        await supabase.from("section_content").delete().eq("content_id", id);
        await supabase.from("kids_content_categories").delete().eq("content_id", id);
        await supabase.from("notifications").delete().eq("content_id", id);
        await supabase.from("hero_banners").delete().eq("content_id", id);
        
        // Finally delete the content
        const { error } = await supabase.from("content").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-health-content"] });
      queryClient.invalidateQueries({ queryKey: ["content-health-episodes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      toast.success(`${itemsToDelete.length} item(s) deleted successfully`);
      setSelectedContent(new Set());
      setSelectedDuplicates(new Map());
      setItemsToDelete([]);
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  // Update content URL mutation
  const updateContentUrlMutation = useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      const { error } = await supabase
        .from("content")
        .update({ video_url: url, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-health-content"] });
      toast.success("URL updated successfully");
    },
  });

  // Update episode URL mutation
  const updateEpisodeUrlMutation = useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      const { error } = await supabase
        .from("episodes")
        .update({ video_url: url, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-health-episodes"] });
      toast.success("Episode URL updated successfully");
    },
  });

  // Validate URLs
  const validateUrls = async (urls: string[]) => {
    setValidatingUrls(true);
    setValidationProgress(0);
    const results = new Map<string, boolean>();
    
    const batchSize = 5;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase.functions.invoke("check-video-url", {
          body: { urls: batch },
        });
        
        if (!error && data?.results) {
          data.results.forEach((result: any, index: number) => {
            results.set(batch[index], result.valid);
          });
        }
      } catch (err) {
        console.error("URL validation error:", err);
        batch.forEach(url => results.set(url, false));
      }
      
      setValidationProgress(Math.round(((i + batch.length) / urls.length) * 100));
    }
    
    setUrlValidationResults(results);
    setValidatingUrls(false);
    
    const validCount = Array.from(results.values()).filter(v => v).length;
    toast.success(`Validated ${urls.length} URLs: ${validCount} valid, ${urls.length - validCount} invalid`);
  };

  // Export CSV of missing URLs
  const exportMissingUrlsCsv = () => {
    const contentRows = healthMetrics.contentWithoutUrl.map(c => 
      `content,${c.id},"${c.title}",${c.content_type},`
    );
    const episodeRows = healthMetrics.episodesWithoutUrl.map(e => 
      `episode,${e.id},"${e.content_title || ''} - S${e.season_number || '?'}E${e.episode_number}",${e.title},`
    );
    
    const csv = `type,id,title,extra,video_url\n${[...contentRows, ...episodeRows].join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `missing-urls-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  // Toggle selection
  const toggleContentSelection = (id: string) => {
    const newSet = new Set(selectedContent);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedContent(newSet);
  };

  const toggleEpisodeSelection = (id: string) => {
    const newSet = new Set(selectedEpisodes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedEpisodes(newSet);
  };

  const toggleDuplicateSelection = (groupKey: string, id: string) => {
    const newMap = new Map(selectedDuplicates);
    if (!newMap.has(groupKey)) newMap.set(groupKey, new Set());
    const set = newMap.get(groupKey)!;
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setSelectedDuplicates(newMap);
  };

  const handleBulkDelete = (ids: string[]) => {
    setItemsToDelete(ids);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteContentMutation.mutate(itemsToDelete);
    setDeleteDialogOpen(false);
  };

  const handleUrlEdit = (id: string, url: string) => {
    setEditingUrls(new Map(editingUrls).set(id, url));
  };

  const saveUrl = (id: string, type: "content" | "episode") => {
    const url = editingUrls.get(id);
    if (!url) return;
    
    if (type === "content") {
      updateContentUrlMutation.mutate({ id, url });
    } else {
      updateEpisodeUrlMutation.mutate({ id, url });
    }
    
    setEditingUrls(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const isLoading = contentLoading || episodesLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display">Content Health Dashboard</h2>
          <p className="text-muted-foreground">Monitor and fix content issues</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => { refetchContent(); refetchEpisodes(); }}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="gap-2">
            <Eye className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="missing-urls" className="gap-2">
            <Link2 className="h-4 w-4" />
            Missing URLs
            {(healthMetrics.contentWithoutUrl.length + healthMetrics.episodesWithoutUrl.length) > 0 && (
              <Badge variant="destructive" className="ml-1">
                {healthMetrics.contentWithoutUrl.length + healthMetrics.episodesWithoutUrl.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="gap-2">
            <Copy className="h-4 w-4" />
            Duplicates
            {healthMetrics.duplicateCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {healthMetrics.duplicateCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="validation" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            URL Validation
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Content</CardTitle>
                <Film className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthMetrics.totalContent}</div>
                <p className="text-xs text-muted-foreground">
                  {content.filter(c => c.content_type === "movie").length} movies, {content.filter(c => c.content_type === "series").length} series
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Missing Video URLs</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-500">
                  {healthMetrics.contentWithoutUrl.length + healthMetrics.episodesWithoutUrl.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {healthMetrics.contentWithoutUrl.length} content, {healthMetrics.episodesWithoutUrl.length} episodes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Duplicate Content</CardTitle>
                <Copy className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-500">
                  {healthMetrics.duplicateCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  In {healthMetrics.duplicateGroups.length} groups
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Episodes</CardTitle>
                <Tv className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthMetrics.totalEpisodes}</div>
                <p className="text-xs text-muted-foreground">
                  Across all series
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setActiveTab("missing-urls")}>
                <Link2 className="h-4 w-4 mr-2" />
                Fix Missing URLs ({healthMetrics.contentWithoutUrl.length + healthMetrics.episodesWithoutUrl.length})
              </Button>
              <Button variant="outline" onClick={() => setActiveTab("duplicates")}>
                <Copy className="h-4 w-4 mr-2" />
                Review Duplicates ({healthMetrics.duplicateGroups.length} groups)
              </Button>
              <Button variant="outline" onClick={exportMissingUrlsCsv}>
                <Download className="h-4 w-4 mr-2" />
                Export Missing URLs CSV
              </Button>
            </CardContent>
          </Card>

          {/* Recent Issues */}
          {healthMetrics.contentWithoutUrl.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Content Missing Video URLs</CardTitle>
                <CardDescription>Most recent content without video URLs</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {healthMetrics.contentWithoutUrl.slice(0, 10).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Badge variant={item.content_type === "movie" ? "default" : "secondary"}>
                            {item.content_type === "movie" ? <Film className="h-3 w-3 mr-1" /> : <Tv className="h-3 w-3 mr-1" />}
                            {item.content_type}
                          </Badge>
                          <span className="font-medium">{item.title}</span>
                          {item.year && <span className="text-muted-foreground">({item.year})</span>}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setActiveTab("missing-urls")}>
                          Fix
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Missing URLs Tab */}
        <TabsContent value="missing-urls" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {/* Content Type Filter */}
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <Button
                  variant={missingUrlFilter === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMissingUrlFilter("all")}
                  className="gap-1"
                >
                  All
                  <Badge variant="secondary" className="ml-1">
                    {healthMetrics.contentWithoutUrl.length}
                  </Badge>
                </Button>
                <Button
                  variant={missingUrlFilter === "movie" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMissingUrlFilter("movie")}
                  className="gap-1"
                >
                  <Film className="h-3.5 w-3.5" />
                  Movies
                  <Badge variant="secondary" className="ml-1">
                    {healthMetrics.contentWithoutUrl.filter(c => c.content_type === "movie").length}
                  </Badge>
                </Button>
                <Button
                  variant={missingUrlFilter === "series" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setMissingUrlFilter("series")}
                  className="gap-1"
                >
                  <Tv className="h-3.5 w-3.5" />
                  TV Shows
                  <Badge variant="secondary" className="ml-1">
                    {healthMetrics.contentWithoutUrl.filter(c => c.content_type === "series").length}
                  </Badge>
                </Button>
              </div>
              {selectedContent.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkDelete(Array.from(selectedContent))}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedContent.size})
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={exportMissingUrlsCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Movies/Series without URLs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileVideo className="h-5 w-5" />
                Content Without Video URLs ({
                  missingUrlFilter === "all" 
                    ? healthMetrics.contentWithoutUrl.length 
                    : healthMetrics.contentWithoutUrl.filter(c => c.content_type === missingUrlFilter).length
                })
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthMetrics.contentWithoutUrl.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>All content has video URLs</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {healthMetrics.contentWithoutUrl
                      .filter(item => missingUrlFilter === "all" || item.content_type === missingUrlFilter)
                      .map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <Checkbox
                          checked={selectedContent.has(item.id)}
                          onCheckedChange={() => toggleContentSelection(item.id)}
                        />
                        <img 
                          src={item.thumbnail_url || "/placeholder.svg"} 
                          alt={item.title}
                          className="w-16 h-24 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={item.content_type === "movie" ? "default" : "secondary"}>
                              {item.content_type}
                            </Badge>
                            <span className="font-medium truncate">{item.title}</span>
                            {item.year && <span className="text-muted-foreground text-sm">({item.year})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Enter video URL..."
                              value={editingUrls.get(item.id) || ""}
                              onChange={e => handleUrlEdit(item.id, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              disabled={!editingUrls.get(item.id) || updateContentUrlMutation.isPending}
                              onClick={() => saveUrl(item.id, "content")}
                            >
                              {updateContentUrlMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleBulkDelete([item.id])}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Episodes without URLs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tv className="h-5 w-5" />
                Episodes Without Video URLs ({healthMetrics.episodesWithoutUrl.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthMetrics.episodesWithoutUrl.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>All episodes have video URLs</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {healthMetrics.episodesWithoutUrl.map(ep => (
                      <div key={ep.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <Checkbox
                          checked={selectedEpisodes.has(ep.id)}
                          onCheckedChange={() => toggleEpisodeSelection(ep.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {ep.content_title || "Unknown Series"} - S{ep.season_number || "?"}E{ep.episode_number}
                          </div>
                          <div className="text-muted-foreground text-xs">{ep.title}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <Input
                              placeholder="Enter video URL..."
                              value={editingUrls.get(ep.id) || ""}
                              onChange={e => handleUrlEdit(ep.id, e.target.value)}
                              className="flex-1 h-8 text-sm"
                            />
                            <Button
                              size="sm"
                              disabled={!editingUrls.get(ep.id) || updateEpisodeUrlMutation.isPending}
                              onClick={() => saveUrl(ep.id, "episode")}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Duplicates Tab */}
        <TabsContent value="duplicates" className="space-y-6">
          {healthMetrics.duplicateGroups.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold mb-2">No Duplicates Found</h3>
                <p className="text-muted-foreground">All content titles are unique</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Duplicate Content Groups ({healthMetrics.duplicateGroups.length})</CardTitle>
                  <CardDescription>
                    Review and manage duplicate content entries. Select items to delete, keeping the best version.
                  </CardDescription>
                </CardHeader>
              </Card>

              {healthMetrics.duplicateGroups.map(group => (
                <Card key={group.key}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={group.contentType === "movie" ? "default" : "secondary"}>
                          {group.contentType === "movie" ? <Film className="h-3 w-3 mr-1" /> : <Tv className="h-3 w-3 mr-1" />}
                          {group.contentType}
                        </Badge>
                        <CardTitle className="text-lg">{group.title}</CardTitle>
                        <Badge variant="outline">{group.items.length} duplicates</Badge>
                      </div>
                      {(selectedDuplicates.get(group.key)?.size || 0) > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleBulkDelete(Array.from(selectedDuplicates.get(group.key) || []))}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Selected ({selectedDuplicates.get(group.key)?.size})
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {group.items.map((item, index) => (
                        <div 
                          key={item.id} 
                          className={`relative p-3 rounded-lg border ${
                            selectedDuplicates.get(group.key)?.has(item.id) 
                              ? "border-destructive bg-destructive/5" 
                              : "bg-card"
                          }`}
                        >
                          <div className="absolute top-2 left-2 z-10">
                            <Checkbox
                              checked={selectedDuplicates.get(group.key)?.has(item.id) || false}
                              onCheckedChange={() => toggleDuplicateSelection(group.key, item.id)}
                            />
                          </div>
                          {index === 0 && (
                            <Badge className="absolute top-2 right-2 bg-green-500">Suggested Keep</Badge>
                          )}
                          <div className="flex gap-3 mt-6">
                            <img 
                              src={item.thumbnail_url || "/placeholder.svg"} 
                              alt={item.title}
                              className="w-20 h-28 object-cover rounded"
                            />
                            <div className="flex-1 space-y-1 text-sm">
                              <div className="font-medium">{item.title}</div>
                              <div className="text-muted-foreground">Year: {item.year || "N/A"}</div>
                              <div className="text-muted-foreground">Genre: {item.genre || "N/A"}</div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">URL:</span>
                                {item.video_url ? (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-500" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ID: {item.id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* URL Validation Tab */}
        <TabsContent value="validation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Batch URL Validation</CardTitle>
              <CardDescription>
                Validate all video URLs to find broken or inaccessible links
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => {
                    const urls = content
                      .filter(c => c.video_url)
                      .map(c => c.video_url!)
                      .filter(Boolean);
                    validateUrls(urls);
                  }}
                  disabled={validatingUrls}
                >
                  {validatingUrls ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Validate All Content URLs
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const urls = episodes
                      .filter(e => e.video_url)
                      .map(e => e.video_url!)
                      .filter(Boolean);
                    validateUrls(urls);
                  }}
                  disabled={validatingUrls}
                >
                  Validate Episode URLs
                </Button>
              </div>

              {validatingUrls && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Validating URLs...</span>
                    <span>{validationProgress}%</span>
                  </div>
                  <Progress value={validationProgress} />
                </div>
              )}

              {urlValidationResults.size > 0 && !validatingUrls && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Valid: {Array.from(urlValidationResults.values()).filter(v => v).length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>Invalid: {Array.from(urlValidationResults.values()).filter(v => !v).length}</span>
                    </div>
                  </div>

                  {/* Show invalid URLs */}
                  {Array.from(urlValidationResults.entries())
                    .filter(([, valid]) => !valid)
                    .length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-destructive">Invalid URLs</h4>
                      <ScrollArea className="h-[200px] rounded-lg border p-3">
                        {Array.from(urlValidationResults.entries())
                          .filter(([, valid]) => !valid)
                          .map(([url]) => {
                            const item = content.find(c => c.video_url === url);
                            return (
                              <div key={url} className="flex items-center justify-between py-2 border-b last:border-0">
                                <div>
                                  <div className="font-medium text-sm">{item?.title || "Unknown"}</div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[400px]">{url}</div>
                                </div>
                                <Button size="sm" variant="outline" asChild>
                                  <a href={url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Test
                                  </a>
                                </Button>
                              </div>
                            );
                          })}
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {itemsToDelete.length} item(s) and all associated data 
              (seasons, episodes, watch history, reviews, etc.). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteContentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
