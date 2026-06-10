import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllContent } from "@/lib/fetchAllContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Image, Loader2, ArrowUp, ArrowDown } from "lucide-react";

export const HeroBannerManagement = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    description: "",
    image_url: "",
    video_url: "",
    video_start_time: 0,
    video_duration: null as number | null,
    cta_text: "Watch Now",
    cta_link: "",
    content_id: "",
    is_active: true,
    display_order: 0,
    start_date: "",
    end_date: "",
  });

  // Fetch banners
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["admin-hero-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_banners")
        .select("*, content:content_id(id, title)")
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch content for linking
  const { data: content = [] } = useQuery({
    queryKey: ["content-for-banner"],
    queryFn: async () => {
      return await fetchAllContent<{ id: string; title: string }>(
        "id, title",
        (q) => q.order("title")
      );
    },
  });

  // Create mutation
  const createBanner = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hero_banners").insert({
        ...formData,
        content_id: formData.content_id && formData.content_id !== "none" ? formData.content_id : null,
        video_duration: formData.video_duration || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hero-banners"] });
      resetForm();
      toast.success("Banner created!");
    },
    onError: () => {
      toast.error("Failed to create banner");
    },
  });

  // Update mutation
  const updateBanner = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("hero_banners")
        .update({
          ...formData,
          content_id: formData.content_id && formData.content_id !== "none" ? formData.content_id : null,
          video_duration: formData.video_duration || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        })
        .eq("id", editingItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hero-banners"] });
      resetForm();
      toast.success("Banner updated!");
    },
    onError: () => {
      toast.error("Failed to update banner");
    },
  });

  // Delete mutation
  const deleteBanner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hero_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hero-banners"] });
      toast.success("Banner deleted");
    },
    onError: () => {
      toast.error("Failed to delete banner");
    },
  });

  // Reorder mutation
  const reorderBanner = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: "up" | "down" }) => {
      const currentIndex = banners.findIndex((b: any) => b.id === id);
      if (
        (direction === "up" && currentIndex === 0) ||
        (direction === "down" && currentIndex === banners.length - 1)
      ) {
        return;
      }

      const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const currentBanner = banners[currentIndex];
      const swapBanner = banners[swapIndex];

      await supabase
        .from("hero_banners")
        .update({ display_order: swapBanner.display_order })
        .eq("id", currentBanner.id);

      await supabase
        .from("hero_banners")
        .update({ display_order: currentBanner.display_order })
        .eq("id", swapBanner.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hero-banners"] });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      subtitle: "",
      description: "",
      image_url: "",
      video_url: "",
      video_start_time: 0,
      video_duration: null,
      cta_text: "Watch Now",
      cta_link: "",
      content_id: "",
      is_active: true,
      display_order: banners.length,
      start_date: "",
      end_date: "",
    });
    setEditingItem(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      subtitle: item.subtitle || "",
      description: item.description || "",
      image_url: item.image_url || "",
      video_url: item.video_url || "",
      video_start_time: item.video_start_time || 0,
      video_duration: item.video_duration || null,
      cta_text: item.cta_text || "Watch Now",
      cta_link: item.cta_link || "",
      content_id: item.content_id || "",
      is_active: item.is_active,
      display_order: item.display_order,
      start_date: item.start_date?.split("T")[0] || "",
      end_date: item.end_date?.split("T")[0] || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title) {
      toast.error("Title is required");
      return;
    }
    if (editingItem) {
      updateBanner.mutate();
    } else {
      createBanner.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Image className="h-6 w-6 text-brand" />
            Hero Banner Management
          </h2>
          <p className="text-muted-foreground">
            Manage homepage hero banners with images or videos
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Banner" : "Add Banner"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Banner title"
                />
              </div>

              <div className="space-y-2">
                <Label>Subtitle</Label>
                <Input
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="Optional subtitle"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Link to Content</Label>
                <Select
                  value={formData.content_id}
                  onValueChange={(v) => setFormData({ ...formData, content_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select content (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {content.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Background Image URL</Label>
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>Background Video URL (optional - overrides image)</Label>
                <Input
                  value={formData.video_url}
                  onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                  placeholder="https://... (mp4 format recommended)"
                />
              </div>

              {/* Video Preview Settings - Only show when video URL is provided */}
              {formData.video_url && (
                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label>Video Start Time (seconds)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.video_start_time}
                      onChange={(e) => setFormData({ ...formData, video_start_time: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">e.g., 1200 = 20 minutes</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Video Duration (seconds)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.video_duration || ""}
                      onChange={(e) => setFormData({ ...formData, video_duration: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Full video"
                    />
                    <p className="text-xs text-muted-foreground">Leave empty for full</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CTA Button Text</Label>
                  <Input
                    value={formData.cta_text}
                    onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                    placeholder="Watch Now"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CTA Link (optional)</Label>
                  <Input
                    value={formData.cta_link}
                    onChange={(e) => setFormData({ ...formData, cta_link: e.target.value })}
                    placeholder="/content/..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date (optional)</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSubmit} disabled={createBanner.isPending || updateBanner.isPending}>
                  {(createBanner.isPending || updateBanner.isPending) ? "Saving..." : editingItem ? "Update" : "Create"}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No banners yet. The homepage will use featured content as fallback.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Media</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banners.map((banner: any, index: number) => (
              <TableRow key={banner.id}>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => reorderBanner.mutate({ id: banner.id, direction: "up" })}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => reorderBanner.mutate({ id: banner.id, direction: "down" })}
                      disabled={index === banners.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{banner.title}</TableCell>
                <TableCell>{banner.content?.title || "-"}</TableCell>
                <TableCell>
                  {banner.video_url ? "Video" : banner.image_url ? "Image" : "-"}
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      banner.is_active
                        ? "bg-green-500/20 text-green-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {banner.is_active ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(banner)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteBanner.mutate(banner.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
