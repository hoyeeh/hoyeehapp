import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, Trash2, Edit2, Save, X, Baby, Tag
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GRADIENT_OPTIONS = [
  { value: "from-pink-500 to-rose-500", label: "Pink" },
  { value: "from-purple-500 to-violet-500", label: "Purple" },
  { value: "from-blue-500 to-cyan-500", label: "Blue" },
  { value: "from-green-500 to-emerald-500", label: "Green" },
  { value: "from-yellow-500 to-orange-500", label: "Orange" },
  { value: "from-red-500 to-rose-500", label: "Red" },
  { value: "from-indigo-500 to-purple-500", label: "Indigo" },
  { value: "from-cyan-500 to-teal-500", label: "Teal" },
];

const EMOJI_OPTIONS = ["📚", "🌙", "🎵", "🚀", "🦁", "🦸", "🎨", "🎮", "🌈", "🎪", "🎬", "⭐", "🎭", "🎯"];

export const KidsCategoryManagement = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    emoji: "📚",
    color: "from-pink-500 to-rose-500",
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["admin-kids-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all kids content
  const { data: kidsContent = [] } = useQuery({
    queryKey: ["admin-kids-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, thumbnail_url")
        .in("content_rating", ["G", "PG", "TV-G", "TV-Y", "TV-Y7", "TV-PG"])
        .order("title");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch category mappings
  const { data: categoryMappings = [] } = useQuery({
    queryKey: ["admin-kids-category-mappings", selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const { data, error } = await supabase
        .from("kids_content_categories")
        .select("content_id")
        .eq("category_id", selectedCategory);
      if (error) throw error;
      return data?.map((m) => m.content_id) || [];
    },
    enabled: !!selectedCategory,
  });

  // Create category
  const createMutation = useMutation({
    mutationFn: async (category: { name: string; emoji: string; color: string }) => {
      const slug = category.name.toLowerCase().replace(/\s+/g, "-");
      const maxOrder = Math.max(0, ...categories.map((c: any) => c.display_order || 0));
      
      const { error } = await supabase
        .from("kids_categories")
        .insert({
          name: category.name,
          slug,
          emoji: category.emoji,
          color: category.color,
          display_order: maxOrder + 1,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-categories"] });
      setShowAddDialog(false);
      setNewCategory({ name: "", emoji: "📚", color: "from-pink-500 to-rose-500" });
      toast.success("Category created!");
    },
  });

  // Update category
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("kids_categories")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-categories"] });
      setEditingId(null);
      toast.success("Category updated!");
    },
  });

  // Delete category
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("kids_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-categories"] });
      toast.success("Category deleted!");
    },
  });

  // Toggle content in category
  const toggleContentMutation = useMutation({
    mutationFn: async ({ contentId, categoryId, add }: { contentId: string; categoryId: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase
          .from("kids_content_categories")
          .insert({ content_id: contentId, category_id: categoryId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("kids_content_categories")
          .delete()
          .eq("content_id", contentId)
          .eq("category_id", categoryId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-kids-category-mappings"] });
      toast.success("Content updated!");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Baby className="h-6 w-6 text-cyan-500" />
          <h2 className="text-xl font-semibold">Kids Categories</h2>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Kids Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g., Learn with Fun"
                />
              </div>
              <div>
                <Label>Emoji</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setNewCategory({ ...newCategory, emoji })}
                      className={`p-2 rounded-lg text-2xl ${
                        newCategory.emoji === emoji ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {GRADIENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setNewCategory({ ...newCategory, color: opt.value })}
                      className={`w-12 h-8 rounded-lg bg-gradient-to-r ${opt.value} ${
                        newCategory.color === opt.value ? "ring-2 ring-white ring-offset-2 ring-offset-background" : ""
                      }`}
                    />
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate(newCategory)}
                disabled={!newCategory.name}
              >
                Create Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories List */}
      <div className="grid gap-4">
        {categories.map((category: any) => (
          <Card key={category.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center text-2xl`}>
                    {category.emoji}
                  </div>
                  <div>
                    <h3 className="font-medium">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">/{category.slug}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={category.is_active}
                    onCheckedChange={(checked) => {
                      updateMutation.mutate({
                        id: category.id,
                        updates: { is_active: checked },
                      });
                    }}
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setShowAssignDialog(true);
                    }}
                  >
                    <Tag className="h-4 w-4 mr-2" />
                    Assign Content
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(category.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assign Content Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Assign Content to {categories.find((c: any) => c.id === selectedCategory)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {kidsContent.map((content: any) => {
              const isAssigned = categoryMappings.includes(content.id);
              return (
                <button
                  key={content.id}
                  onClick={() => {
                    if (selectedCategory) {
                      toggleContentMutation.mutate({
                        contentId: content.id,
                        categoryId: selectedCategory,
                        add: !isAssigned,
                      });
                    }
                  }}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    isAssigned ? "border-primary" : "border-transparent hover:border-muted"
                  }`}
                >
                  <img
                    src={content.thumbnail_url || "/placeholder.svg"}
                    alt={content.title}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2">
                    <span className="text-white text-sm font-medium truncate">{content.title}</span>
                  </div>
                  {isAssigned && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Tag className="h-3 w-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
