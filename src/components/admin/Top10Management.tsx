import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Crown, Trash2, Loader2, Trophy } from "lucide-react";

interface Top10Item {
  id: string;
  content_id: string;
  rank: number;
  content: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    content_type: string;
  };
}

interface ContentItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  content_type: string;
}

export const Top10Management = () => {
  const queryClient = useQueryClient();
  const [selectedRank, setSelectedRank] = useState<number>(1);
  const [selectedContent, setSelectedContent] = useState<string>("");

  const { data: top10 = [], isLoading } = useQuery({
    queryKey: ["top-10"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top_10")
        .select(`
          id,
          content_id,
          rank,
          content:content_id (
            id,
            title,
            thumbnail_url,
            content_type
          )
        `)
        .order("rank");
      if (error) throw error;
      return data as unknown as Top10Item[];
    },
  });

  const { data: allContent = [] } = useQuery({
    queryKey: ["all-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, thumbnail_url, content_type")
        .order("title");
      if (error) throw error;
      return data as ContentItem[];
    },
  });

  // Filter out content already in top 10
  const availableContent = allContent.filter(
    (c) => !top10.some((t) => t.content_id === c.id)
  );

  // Get available ranks (1-10 not yet used)
  const usedRanks = top10.map((t) => t.rank);
  const availableRanks = Array.from({ length: 10 }, (_, i) => i + 1).filter(
    (r) => !usedRanks.includes(r)
  );

  const addToTop10 = useMutation({
    mutationFn: async ({ contentId, rank }: { contentId: string; rank: number }) => {
      const { error } = await supabase
        .from("top_10")
        .insert({ content_id: contentId, rank });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["top-10"] });
      setSelectedContent("");
      toast.success("Added to Top 10");
    },
    onError: (error: any) => {
      console.error("Error adding to top 10:", error);
      toast.error("Failed to add to Top 10");
    },
  });

  const removeFromTop10 = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("top_10").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["top-10"] });
      toast.success("Removed from Top 10");
    },
    onError: () => toast.error("Failed to remove from Top 10"),
  });

  const handleAdd = () => {
    if (!selectedContent) {
      toast.error("Please select content");
      return;
    }
    addToTop10.mutate({ contentId: selectedContent, rank: selectedRank });
  };

  const handleRemove = (id: string, title: string) => {
    if (confirm(`Remove "${title}" from Top 10?`)) {
      removeFromTop10.mutate(id);
    }
  };

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand" />
          Top 10 Management
        </CardTitle>
        <CardDescription>
          Select and rank the top 10 movies/shows to feature prominently like Netflix
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add to Top 10 */}
        {availableRanks.length > 0 && availableContent.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 p-4 bg-secondary/30 rounded-lg">
            <Select value={selectedRank.toString()} onValueChange={(v) => setSelectedRank(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Rank" />
              </SelectTrigger>
              <SelectContent>
                {availableRanks.map((rank) => (
                  <SelectItem key={rank} value={rank.toString()}>
                    #{rank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedContent} onValueChange={setSelectedContent}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select content..." />
              </SelectTrigger>
              <SelectContent>
                {availableContent.map((content) => (
                  <SelectItem key={content.id} value={content.id}>
                    {content.title} ({content.content_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={addToTop10.isPending}>
              {addToTop10.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add to Top 10
            </Button>
          </div>
        )}

        {/* Current Top 10 */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : top10.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Crown className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No content in Top 10 yet</p>
            <p className="text-sm">Add movies or shows above to feature them</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {top10.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-brand to-brand-dark rounded-lg flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-lg">
                  {item.rank}
                </div>
                {item.content?.thumbnail_url && (
                  <img
                    src={item.content.thumbnail_url}
                    alt={item.content?.title}
                    className="w-16 h-20 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{item.content?.title}</h4>
                  <p className="text-sm text-muted-foreground capitalize">
                    {item.content?.content_type}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(item.id, item.content?.title || "")}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
