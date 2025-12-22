import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Youtube, Baby, Check } from "lucide-react";
import { toast } from "sonner";

interface KidsCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface YouTubeChannel {
  id: string;
  name: string;
  channel_id: string;
  description: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  is_kids_friendly: boolean;
  kids_category_id: string | null;
}

interface KidsYouTubeTabProps {
  categories: KidsCategory[];
}

export const KidsYouTubeTab = ({ categories }: KidsYouTubeTabProps) => {
  const queryClient = useQueryClient();

  // Fetch all YouTube channels
  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["admin-youtube-channels-kids"],
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

  // Toggle kids friendly
  const toggleKidsFriendly = useMutation({
    mutationFn: async ({ id, isKidsFriendly }: { id: string; isKidsFriendly: boolean }) => {
      const { error } = await supabase
        .from("youtube_channels")
        .update({ is_kids_friendly: isKidsFriendly })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-youtube-channels-kids"] });
      queryClient.invalidateQueries({ queryKey: ["kids-youtube-videos"] });
      toast.success("Channel updated!");
    },
    onError: () => {
      toast.error("Failed to update channel");
    },
  });

  // Update category
  const updateCategory = useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
      const { error } = await supabase
        .from("youtube_channels")
        .update({ kids_category_id: categoryId })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-youtube-channels-kids"] });
      toast.success("Category updated!");
    },
    onError: () => {
      toast.error("Failed to update category");
    },
  });

  const kidsFriendlyCount = channels.filter(c => c.is_kids_friendly).length;

  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-24 bg-muted/20" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center">
              <Youtube className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Kids-Friendly YouTube Channels</h3>
              <p className="text-sm text-muted-foreground">
                {kidsFriendlyCount} of {channels.length} channels marked as kids-friendly
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {channels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Youtube className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No YouTube Channels</h3>
            <p className="text-sm text-muted-foreground">
              Add YouTube channels in the main YouTube management section first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {channels.map((channel) => (
            <Card key={channel.id} className={channel.is_kids_friendly ? "ring-2 ring-green-500/50 bg-green-500/5" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={channel.thumbnail_url || "/placeholder.svg"}
                      alt={channel.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold truncate">{channel.name}</h4>
                      {channel.is_kids_friendly && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
                          <Baby className="h-3 w-3" />
                          Kids
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {channel.description || "No description"}
                    </p>
                  </div>

                  {/* Kids Friendly Toggle */}
                  <div className="flex items-center gap-6">
                    {/* Category Select */}
                    {channel.is_kids_friendly && (
                      <div className="w-40">
                        <Select
                          value={channel.kids_category_id || "none"}
                          onValueChange={(value) => 
                            updateCategory.mutate({ 
                              id: channel.id, 
                              categoryId: value === "none" ? null : value 
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Category..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No category</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.emoji} {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Label htmlFor={`kids-${channel.id}`} className="text-sm text-muted-foreground">
                        Kids Friendly
                      </Label>
                      <Switch
                        id={`kids-${channel.id}`}
                        checked={channel.is_kids_friendly}
                        onCheckedChange={(checked) => 
                          toggleKidsFriendly.mutate({ id: channel.id, isKidsFriendly: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
