import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Users, Download, CheckCircle, AlertCircle, Film, Tv } from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  tmdb_id: number | null;
  content_type: string;
  cast_members: any;
  director: string | null;
  thumbnail_url: string | null;
}

export const BulkCastImport = () => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });

  // Fetch content without cast data
  const { data: contentWithoutCast = [], isLoading } = useQuery({
    queryKey: ["content-without-cast"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, tmdb_id, content_type, cast_members, director, thumbnail_url")
        .not("tmdb_id", "is", null)
        .order("title");

      if (error) throw error;
      
      // Filter to content without cast or director
      return (data || []).filter((item: ContentItem) => {
        const hasCast = item.cast_members && Array.isArray(item.cast_members) && item.cast_members.length > 0;
        return !hasCast || !item.director;
      });
    },
  });

  const updateContent = useMutation({
    mutationFn: async ({ id, cast_members, director }: { id: string; cast_members: any; director: string | null }) => {
      const { error } = await supabase
        .from("content")
        .update({ cast_members, director })
        .eq("id", id);
      if (error) throw error;
    },
  });

  const handleSelectAll = () => {
    if (selectedIds.size === contentWithoutCast.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contentWithoutCast.map((c: ContentItem) => c.id)));
    }
  };

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleImport = async () => {
    const selectedContent = contentWithoutCast.filter((c: ContentItem) => selectedIds.has(c.id));
    if (selectedContent.length === 0) {
      toast.error("Please select content to import");
      return;
    }

    setImporting(true);
    setProgress(0);
    setResults({ success: 0, failed: 0 });

    let success = 0;
    let failed = 0;

    for (let i = 0; i < selectedContent.length; i++) {
      const content = selectedContent[i];
      
      try {
        // Fetch cast/director from TMDB
        const { data, error } = await supabase.functions.invoke('tmdb-details', {
          body: { 
            tmdb_id: content.tmdb_id, 
            type: content.content_type === 'series' ? 'series' : 'movie' 
          }
        });

        if (error) throw error;

        if (data && (data.cast || data.director)) {
          await updateContent.mutateAsync({
            id: content.id,
            cast_members: data.cast || [],
            director: data.director || null,
          });
          success++;
        } else {
          failed++;
        }
      } catch (e) {
        console.error(`Failed to import cast for ${content.title}:`, e);
        failed++;
      }

      setProgress(Math.round(((i + 1) / selectedContent.length) * 100));
      setResults({ success, failed });

      // Small delay to avoid rate limiting
      if (i < selectedContent.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["content-without-cast"] });
    queryClient.invalidateQueries({ queryKey: ["admin-content"] });
    queryClient.invalidateQueries({ queryKey: ["content"] });

    if (success > 0) {
      toast.success(`Imported cast data for ${success} items`);
    }
    if (failed > 0) {
      toast.error(`Failed to import ${failed} items`);
    }

    setSelectedIds(new Set());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Bulk Cast Import from TMDB
        </CardTitle>
        <CardDescription>
          Import cast members and director information from TMDB for content that is missing this data.
          {contentWithoutCast.length > 0 && (
            <span className="text-brand ml-1">
              {contentWithoutCast.length} items need cast data.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {contentWithoutCast.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-lg font-medium">All content has cast data!</p>
            <p className="text-sm text-muted-foreground">
              No content is missing cast or director information.
            </p>
          </div>
        ) : (
          <>
            {/* Actions Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedIds.size === contentWithoutCast.length && contentWithoutCast.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} of {contentWithoutCast.length} selected
                </span>
              </div>
              <Button
                onClick={handleImport}
                disabled={importing || selectedIds.size === 0}
                className="gap-2"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Import Cast Data
              </Button>
            </div>

            {/* Progress */}
            {importing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Importing... {progress}%</span>
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-green-500">
                      <CheckCircle className="h-3 w-3" /> {results.success}
                    </span>
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3 w-3" /> {results.failed}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Content List */}
            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="divide-y">
                {contentWithoutCast.map((content: ContentItem) => (
                  <div
                    key={content.id}
                    className="flex items-center gap-3 p-3 hover:bg-secondary/50 cursor-pointer"
                    onClick={() => handleToggle(content.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(content.id)}
                      onCheckedChange={() => handleToggle(content.id)}
                    />
                    <div className="w-12 h-16 rounded overflow-hidden bg-secondary flex-shrink-0">
                      {content.thumbnail_url ? (
                        <img
                          src={content.thumbnail_url}
                          alt={content.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {content.content_type === 'series' ? (
                            <Tv className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Film className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{content.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{content.content_type}</span>
                        <span>•</span>
                        <span>TMDB: {content.tmdb_id}</span>
                        {!content.director && (
                          <span className="text-amber-500">Missing director</span>
                        )}
                        {(!content.cast_members || content.cast_members.length === 0) && (
                          <span className="text-amber-500">Missing cast</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
};
