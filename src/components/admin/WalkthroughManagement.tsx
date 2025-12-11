import { useState } from "react";
import { useAdminWalkthroughScreens, useCreateWalkthroughScreen, useUpdateWalkthroughScreen, useDeleteWalkthroughScreen } from "@/hooks/useWalkthroughScreens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Image, GripVertical } from "lucide-react";
import { toast } from "sonner";

export const WalkthroughManagement = () => {
  const { data: screens = [], isLoading } = useAdminWalkthroughScreens();
  const createScreen = useCreateWalkthroughScreen();
  const updateScreen = useUpdateWalkthroughScreen();
  const deleteScreen = useDeleteWalkthroughScreen();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScreen, setEditingScreen] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    display_order: 1,
  });

  const handleOpenDialog = (screen?: any) => {
    if (screen) {
      setEditingScreen(screen);
      setFormData({
        title: screen.title,
        description: screen.description || "",
        image_url: screen.image_url,
        display_order: screen.display_order,
      });
    } else {
      setEditingScreen(null);
      setFormData({
        title: "",
        description: "",
        image_url: "",
        display_order: screens.length + 1,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.image_url) {
      toast.error("Title and image URL are required");
      return;
    }

    try {
      if (editingScreen) {
        await updateScreen.mutateAsync({
          id: editingScreen.id,
          ...formData,
        });
        toast.success("Walkthrough screen updated");
      } else {
        await createScreen.mutateAsync(formData);
        toast.success("Walkthrough screen created");
      }
      setIsDialogOpen(false);
      setEditingScreen(null);
    } catch (error) {
      toast.error("Failed to save walkthrough screen");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this walkthrough screen?")) return;
    
    try {
      await deleteScreen.mutateAsync(id);
      toast.success("Walkthrough screen deleted");
    } catch (error) {
      toast.error("Failed to delete walkthrough screen");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateScreen.mutateAsync({ id, is_active: isActive });
      toast.success(`Screen ${isActive ? "activated" : "deactivated"}`);
    } catch (error) {
      toast.error("Failed to update screen status");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, GIF, or WebP image");
      return;
    }

    // For simplicity, we'll use a URL input. In production, you'd upload to storage.
    const reader = new FileReader();
    reader.onload = (event) => {
      // This would normally upload to Supabase storage
      // For now we'll just show a toast to use URL
      toast.info("Please enter the image URL directly or upload to storage first");
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Walkthrough Screens</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Screen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingScreen ? "Edit Walkthrough Screen" : "Add Walkthrough Screen"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Welcome to Hoyeeh"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Stream unlimited movies and TV shows"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="/walkthrough/image.webp"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Supports PNG, JPG, GIF, and WebP formats
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="display_order">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  min={1}
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createScreen.isPending || updateScreen.isPending}>
                  {editingScreen ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {screens.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            No walkthrough screens configured. Add some to show users on first launch.
          </p>
        ) : (
          <div className="space-y-3">
            {screens.map((screen) => (
              <div
                key={screen.id}
                className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                
                <div className="w-16 h-16 rounded overflow-hidden bg-muted shrink-0">
                  <img
                    src={screen.image_url}
                    alt={screen.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{screen.title}</h4>
                  <p className="text-sm text-muted-foreground truncate">
                    {screen.description || "No description"}
                  </p>
                  <p className="text-xs text-muted-foreground">Order: {screen.display_order}</p>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={screen.is_active}
                      onCheckedChange={(checked) => handleToggleActive(screen.id, checked)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {screen.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(screen)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(screen.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
