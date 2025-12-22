import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, GripVertical, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface YouTubeBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
}

export function YouTubeBannerManagement() {
  const queryClient = useQueryClient();
  const [newBanner, setNewBanner] = useState({
    title: "",
    subtitle: "",
    image_url: "",
    link_url: "",
  });

  const { data: banners, isLoading } = useQuery({
    queryKey: ["admin-youtube-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_banners")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as YouTubeBanner[];
    },
  });

  const addBannerMutation = useMutation({
    mutationFn: async (banner: typeof newBanner) => {
      const maxOrder = banners?.reduce((max, b) => Math.max(max, b.display_order), 0) || 0;
      
      const { error } = await supabase
        .from("youtube_banners")
        .insert({
          title: banner.title,
          subtitle: banner.subtitle || null,
          image_url: banner.image_url,
          link_url: banner.link_url || null,
          display_order: maxOrder + 1,
          is_active: true,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-youtube-banners"] });
      queryClient.invalidateQueries({ queryKey: ["youtube-banners"] });
      setNewBanner({ title: "", subtitle: "", image_url: "", link_url: "" });
      toast.success("Banner added successfully");
    },
    onError: () => {
      toast.error("Failed to add banner");
    },
  });

  const updateBannerMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<YouTubeBanner> }) => {
      const { error } = await supabase
        .from("youtube_banners")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-youtube-banners"] });
      queryClient.invalidateQueries({ queryKey: ["youtube-banners"] });
      toast.success("Banner updated");
    },
    onError: () => {
      toast.error("Failed to update banner");
    },
  });

  const deleteBannerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("youtube_banners")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-youtube-banners"] });
      queryClient.invalidateQueries({ queryKey: ["youtube-banners"] });
      toast.success("Banner deleted");
    },
    onError: () => {
      toast.error("Failed to delete banner");
    },
  });

  const handleAddBanner = () => {
    if (!newBanner.title || !newBanner.image_url) {
      toast.error("Title and image URL are required");
      return;
    }
    addBannerMutation.mutate(newBanner);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          YouTube Hero Banners
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Fallback banners shown when channels don't have cover images
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Banner Form */}
        <div className="border rounded-lg p-4 bg-secondary/30 space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Banner
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="banner-title">Title *</Label>
              <Input
                id="banner-title"
                placeholder="Banner title"
                value={newBanner.title}
                onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="banner-subtitle">Subtitle</Label>
              <Input
                id="banner-subtitle"
                placeholder="Optional subtitle"
                value={newBanner.subtitle}
                onChange={(e) => setNewBanner({ ...newBanner, subtitle: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="banner-image">Image URL *</Label>
              <Input
                id="banner-image"
                placeholder="https://example.com/image.jpg"
                value={newBanner.image_url}
                onChange={(e) => setNewBanner({ ...newBanner, image_url: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="banner-link">Link URL</Label>
              <Input
                id="banner-link"
                placeholder="Optional link"
                value={newBanner.link_url}
                onChange={(e) => setNewBanner({ ...newBanner, link_url: e.target.value })}
              />
            </div>
          </div>
          
          {/* Preview */}
          {newBanner.image_url && (
            <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden bg-secondary">
              <img
                src={newBanner.image_url}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '';
                  e.currentTarget.classList.add('hidden');
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white font-bold">{newBanner.title || "Banner Title"}</p>
                {newBanner.subtitle && (
                  <p className="text-white/70 text-sm">{newBanner.subtitle}</p>
                )}
              </div>
            </div>
          )}
          
          <Button onClick={handleAddBanner} disabled={addBannerMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Add Banner
          </Button>
        </div>

        {/* Existing Banners */}
        <div className="space-y-3">
          <h4 className="font-medium">Existing Banners ({banners?.length || 0})</h4>
          
          {isLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : banners?.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center border rounded-lg">
              No banners yet. Add one above.
            </div>
          ) : (
            <div className="space-y-2">
              {banners?.map((banner) => (
                <div
                  key={banner.id}
                  className="flex items-center gap-4 p-3 border rounded-lg bg-card"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  
                  {/* Thumbnail */}
                  <div className="w-24 aspect-video rounded overflow-hidden bg-secondary flex-shrink-0">
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{banner.title}</p>
                    {banner.subtitle && (
                      <p className="text-sm text-muted-foreground truncate">{banner.subtitle}</p>
                    )}
                  </div>
                  
                  {/* Active Toggle */}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${banner.id}`} className="text-xs text-muted-foreground">
                      Active
                    </Label>
                    <Switch
                      id={`active-${banner.id}`}
                      checked={banner.is_active}
                      onCheckedChange={(checked) =>
                        updateBannerMutation.mutate({ id: banner.id, updates: { is_active: checked } })
                      }
                    />
                  </div>
                  
                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteBannerMutation.mutate(banner.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

