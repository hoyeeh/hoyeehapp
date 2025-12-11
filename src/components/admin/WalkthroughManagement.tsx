import { useState, useRef } from "react";
import { useAdminWalkthroughScreens, useCreateWalkthroughScreen, useUpdateWalkthroughScreen, useDeleteWalkthroughScreen } from "@/hooks/useWalkthroughScreens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, GripVertical, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface WalkthroughScreen {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  display_order: number;
  is_active: boolean;
}

interface SortableScreenItemProps {
  screen: WalkthroughScreen;
  onEdit: (screen: WalkthroughScreen) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

function SortableScreenItem({ screen, onEdit, onDelete, onToggleActive }: SortableScreenItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: screen.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
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
            onCheckedChange={(checked) => onToggleActive(screen.id, checked)}
          />
          <span className="text-xs text-muted-foreground">
            {screen.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(screen)}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(screen.id)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export const WalkthroughManagement = () => {
  const { data: screens = [], isLoading } = useAdminWalkthroughScreens();
  const createScreen = useCreateWalkthroughScreen();
  const updateScreen = useUpdateWalkthroughScreen();
  const deleteScreen = useDeleteWalkthroughScreen();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingScreen, setEditingScreen] = useState<WalkthroughScreen | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    display_order: 1,
  });
  const [isUploading, setIsUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleOpenDialog = (screen?: WalkthroughScreen) => {
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
      toast.error("Title and image are required");
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, GIF, or WebP image");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `walkthrough/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("walkthrough-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("walkthrough-images")
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast.success("Image uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = screens.findIndex((s) => s.id === active.id);
      const newIndex = screens.findIndex((s) => s.id === over.id);
      
      const reordered = arrayMove(screens, oldIndex, newIndex);
      
      // Update display_order for all reordered items
      try {
        await Promise.all(
          reordered.map((screen, index) => 
            updateScreen.mutateAsync({ 
              id: screen.id, 
              display_order: index + 1 
            })
          )
        );
        toast.success("Order updated");
      } catch (error) {
        toast.error("Failed to update order");
      }
    }
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
                <Label>Image</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="Image URL or upload below"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {formData.image_url && (
                  <div className="mt-2 w-full h-32 rounded-lg overflow-hidden bg-muted">
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
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
                <Button type="submit" disabled={createScreen.isPending || updateScreen.isPending || isUploading}>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={screens.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {screens.map((screen) => (
                  <SortableScreenItem
                    key={screen.id}
                    screen={screen}
                    onEdit={handleOpenDialog}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
};
