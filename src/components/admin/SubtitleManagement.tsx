import { matchesSearch } from "@/lib/searchMatch";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Subtitles, 
  Search, 
  Trash2, 
  Edit2, 
  ExternalLink, 
  Languages,
  Film,
  Tv,
  Loader2,
  RefreshCw,
  Eye
} from "lucide-react";
import { format } from "date-fns";

interface Subtitle {
  id: string;
  content_id: string;
  episode_id: string | null;
  language_code: string;
  language_label: string;
  subtitle_url: string;
  cdn_url: string | null;
  word_count: number;
  created_at: string;
  updated_at: string;
  content?: {
    title: string;
    content_type: string;
    thumbnail_url: string | null;
  };
  episode?: {
    title: string;
    episode_number: number;
    season?: {
      season_number: number;
    };
  } | null;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  fra: "🇫🇷",
  eng: "🇬🇧",
  spa: "🇪🇸",
  ara: "🇸🇦",
  deu: "🇩🇪",
  ita: "🇮🇹",
  por: "🇵🇹",
  hin: "🇮🇳",
  zho: "🇨🇳",
  jpn: "🇯🇵",
};

export function SubtitleManagement() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSubtitle, setSelectedSubtitle] = useState<Subtitle | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Fetch all subtitles with content info
  const { data: subtitles = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-subtitles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subtitles")
        .select(`
          *,
          content:content_id (
            title,
            content_type,
            thumbnail_url
          ),
          episode:episode_id (
            title,
            episode_number,
            season:season_id (
              season_number
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Subtitle[];
    },
  });

  // Delete subtitle mutation
  const deleteMutation = useMutation({
    mutationFn: async (subtitleId: string) => {
      const { error } = await supabase
        .from("subtitles")
        .delete()
        .eq("id", subtitleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subtitle deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-subtitles"] });
      setDeleteDialogOpen(false);
      setSelectedSubtitle(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete subtitle: ${error.message}`);
    },
  });

  // Filter subtitles
  const filteredSubtitles = subtitles.filter((sub) => {
    const matches = matchesSearch(searchQuery, sub.content?.title, sub.language_label, sub.language_code);
    const matchesLanguage = languageFilter === "all" || sub.language_code === languageFilter;
    return matches && matchesLanguage;
  });

  // Get unique languages for filter
  const uniqueLanguages = Array.from(new Set(subtitles.map((s) => s.language_code)));

  // Preview subtitle content
  const handlePreview = async (subtitle: Subtitle) => {
    setSelectedSubtitle(subtitle);
    setLoadingPreview(true);
    setPreviewDialogOpen(true);

    try {
      const url = subtitle.cdn_url || subtitle.subtitle_url;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch subtitle");
      const content = await response.text();
      setPreviewContent(content);
    } catch (error) {
      setPreviewContent("Failed to load subtitle content");
    } finally {
      setLoadingPreview(false);
    }
  };

  // Get content display name
  const getContentName = (subtitle: Subtitle) => {
    if (subtitle.episode) {
      const seasonNum = subtitle.episode.season?.season_number || 1;
      return `${subtitle.content?.title} - S${seasonNum}E${subtitle.episode.episode_number}`;
    }
    return subtitle.content?.title || "Unknown Content";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Subtitles className="h-5 w-5 text-primary" />
              <CardTitle>Subtitle Management</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          <CardDescription>
            View, preview, and manage all generated subtitles across your content library
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by content title or language..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger className="w-[180px]">
                <Languages className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Languages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {uniqueLanguages.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LANGUAGE_FLAGS[code] || "🌐"} {subtitles.find((s) => s.language_code === code)?.language_label || code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Total: {subtitles.length} subtitles</span>
            <span>•</span>
            <span>Showing: {filteredSubtitles.length}</span>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredSubtitles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || languageFilter !== "all" 
                ? "No subtitles match your filters"
                : "No subtitles generated yet"}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Words</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubtitles.map((subtitle) => (
                    <TableRow key={subtitle.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-14 bg-muted rounded overflow-hidden flex-shrink-0">
                            {subtitle.content?.thumbnail_url ? (
                              <img 
                                src={subtitle.content.thumbnail_url} 
                                alt={subtitle.content.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {subtitle.episode ? <Tv className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium line-clamp-1">{getContentName(subtitle)}</p>
                            <Badge variant="outline" className="text-xs">
                              {subtitle.episode ? "Episode" : "Movie"}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{LANGUAGE_FLAGS[subtitle.language_code] || "🌐"}</span>
                          <span>{subtitle.language_label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {subtitle.word_count?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell>
                        {format(new Date(subtitle.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePreview(subtitle)}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(subtitle.cdn_url || subtitle.subtitle_url, '_blank')}
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedSubtitle(subtitle);
                              setDeleteDialogOpen(true);
                            }}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Subtitle</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the {selectedSubtitle?.language_label} subtitle for "{selectedSubtitle && getContentName(selectedSubtitle)}"? 
              This will remove the database record but not the file from storage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedSubtitle && deleteMutation.mutate(selectedSubtitle.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Subtitles className="h-5 w-5" />
              Subtitle Preview
            </DialogTitle>
            <DialogDescription>
              {selectedSubtitle && (
                <>
                  {LANGUAGE_FLAGS[selectedSubtitle.language_code]} {selectedSubtitle.language_label} - {getContentName(selectedSubtitle)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto">
            {loadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Textarea
                value={previewContent}
                readOnly
                className="min-h-[300px] font-mono text-sm"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
