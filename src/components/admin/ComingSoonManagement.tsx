import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Edit2, Trash2, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";

export const ComingSoonManagement = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    thumbnail_url: "",
    trailer_url: "",
    content_type: "movie",
    genre: "",
    expected_release_date: "",
    is_active: true,
  });

  // Fetch coming soon items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-coming-soon"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coming_soon")
        .select("*")
        .order("expected_release_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Create mutation
  const createItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coming_soon").insert({
        ...formData,
        expected_release_date: formData.expected_release_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coming-soon"] });
      resetForm();
      toast.success("Coming soon item created!");
    },
    onError: () => {
      toast.error("Failed to create item");
    },
  });

  // Update mutation
  const updateItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("coming_soon")
        .update({
          ...formData,
          expected_release_date: formData.expected_release_date || null,
        })
        .eq("id", editingItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coming-soon"] });
      resetForm();
      toast.success("Coming soon item updated!");
    },
    onError: () => {
      toast.error("Failed to update item");
    },
  });

  // Delete mutation
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coming_soon").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coming-soon"] });
      toast.success("Item deleted");
    },
    onError: () => {
      toast.error("Failed to delete item");
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      thumbnail_url: "",
      trailer_url: "",
      content_type: "movie",
      genre: "",
      expected_release_date: "",
      is_active: true,
    });
    setEditingItem(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      thumbnail_url: item.thumbnail_url || "",
      trailer_url: item.trailer_url || "",
      content_type: item.content_type,
      genre: item.genre || "",
      expected_release_date: item.expected_release_date || "",
      is_active: item.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title) {
      toast.error("Title is required");
      return;
    }
    if (editingItem) {
      updateItem.mutate();
    } else {
      createItem.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-brand" />
            Coming Soon Management
          </h2>
          <p className="text-muted-foreground">
            Manage upcoming movies and TV shows
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Coming Soon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Coming Soon" : "Add Coming Soon"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Title"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Content Type</Label>
                  <Select
                    value={formData.content_type}
                    onValueChange={(v) =>
                      setFormData({ ...formData, content_type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="movie">Movie</SelectItem>
                      <SelectItem value="series">TV Show</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Input
                    value={formData.genre}
                    onChange={(e) =>
                      setFormData({ ...formData, genre: e.target.value })
                    }
                    placeholder="Action, Drama..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Expected Release Date</Label>
                <Input
                  type="date"
                  value={formData.expected_release_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expected_release_date: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Thumbnail URL</Label>
                <Input
                  value={formData.thumbnail_url}
                  onChange={(e) =>
                    setFormData({ ...formData, thumbnail_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label>Trailer URL</Label>
                <Input
                  value={formData.trailer_url}
                  onChange={(e) =>
                    setFormData({ ...formData, trailer_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label>Active</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSubmit} disabled={createItem.isPending || updateItem.isPending}>
                  {(createItem.isPending || updateItem.isPending) ? "Saving..." : editingItem ? "Update" : "Create"}
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
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No coming soon items yet. Add one to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Genre</TableHead>
              <TableHead>Release Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell className="capitalize">{item.content_type}</TableCell>
                <TableCell>{item.genre || "-"}</TableCell>
                <TableCell>
                  {item.expected_release_date
                    ? format(new Date(item.expected_release_date), "MMM d, yyyy")
                    : "-"}
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      item.is_active
                        ? "bg-green-500/20 text-green-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.is_active ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItem.mutate(item.id)}
                    >
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
