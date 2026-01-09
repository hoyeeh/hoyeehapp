import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, ArrowUp, ArrowDown, Monitor, Smartphone } from "lucide-react";

interface ProfileBackground {
  id: string;
  title: string;
  tmdb_id: number | null;
  content_type: string;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  is_active: boolean;
  display_order: number;
}

interface TMDBSearchResult {
  tmdb_id: number;
  title: string;
  content_type: string;
  desktop_image_url: string | null;
  mobile_image_url: string | null;
  year: string;
}

export const ProfileBackgroundManagement = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBackground, setEditingBackground] = useState<ProfileBackground | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"movie" | "series">("movie");
  const [searchResults, setSearchResults] = useState<TMDBSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    tmdb_id: null as number | null,
    content_type: "movie",
    desktop_image_url: "",
    mobile_image_url: "",
    is_active: true,
    display_order: 0,
  });

  const { data: backgrounds = [], isLoading } = useQuery({
    queryKey: ["profile-backgrounds-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_backgrounds")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as ProfileBackground[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingBackground) {
        const { error } = await supabase
          .from("profile_backgrounds")
          .update(data)
          .eq("id", editingBackground.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profile_backgrounds")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-backgrounds-admin"] });
      toast.success(editingBackground ? "Background updated" : "Background added");
      closeDialog();
    },
    onError: (error) => {
      toast.error("Failed to save: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profile_backgrounds")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-backgrounds-admin"] });
      toast.success("Background deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, newOrder }: { id: string; newOrder: number }) => {
      const { error } = await supabase
        .from("profile_backgrounds")
        .update({ display_order: newOrder })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-backgrounds-admin"] });
    },
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("tmdb-profile-background", {
        body: { query: searchQuery, type: searchType },
      });
      
      if (error) throw error;
      setSearchResults(data.results || []);
    } catch (error: any) {
      toast.error("Search failed: " + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result: TMDBSearchResult) => {
    setFormData({
      ...formData,
      title: result.title,
      tmdb_id: result.tmdb_id,
      content_type: result.content_type,
      desktop_image_url: result.desktop_image_url || "",
      mobile_image_url: result.mobile_image_url || "",
    });
    setSearchResults([]);
    setSearchQuery("");
  };

  const openEditDialog = (background: ProfileBackground) => {
    setEditingBackground(background);
    setFormData({
      title: background.title,
      tmdb_id: background.tmdb_id,
      content_type: background.content_type,
      desktop_image_url: background.desktop_image_url || "",
      mobile_image_url: background.mobile_image_url || "",
      is_active: background.is_active,
      display_order: background.display_order,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingBackground(null);
    setFormData({
      title: "",
      tmdb_id: null,
      content_type: "movie",
      desktop_image_url: "",
      mobile_image_url: "",
      is_active: true,
      display_order: backgrounds.length,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingBackground(null);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    saveMutation.mutate(formData);
  };

  const moveBackground = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= backgrounds.length) return;

    const currentBg = backgrounds[index];
    const swapBg = backgrounds[newIndex];

    reorderMutation.mutate({ id: currentBg.id, newOrder: swapBg.display_order });
    reorderMutation.mutate({ id: swapBg.id, newOrder: currentBg.display_order });
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Profile Backgrounds</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Background
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBackground ? "Edit Background" : "Add Background"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* TMDB Search */}
              <div className="space-y-2">
                <Label>Search TMDB</Label>
                <div className="flex gap-2">
                  <Select value={searchType} onValueChange={(v) => setSearchType(v as "movie" | "series")}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="movie">Movie</SelectItem>
                      <SelectItem value="series">TV Series</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Search movies or series..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={result.tmdb_id}
                        onClick={() => selectSearchResult(result)}
                        className="w-full p-2 text-left hover:bg-accent flex items-center gap-3 border-b last:border-b-0"
                      >
                        {result.mobile_image_url && (
                          <img
                            src={result.mobile_image_url}
                            alt={result.title}
                            className="w-10 h-14 object-cover rounded"
                          />
                        )}
                        <div>
                          <p className="font-medium">{result.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {result.year} • {result.content_type}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>TMDB ID</Label>
                  <Input
                    type="number"
                    value={formData.tmdb_id || ""}
                    onChange={(e) => setFormData({ ...formData, tmdb_id: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Content Type</Label>
                <Select
                  value={formData.content_type}
                  onValueChange={(v) => setFormData({ ...formData, content_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="movie">Movie</SelectItem>
                    <SelectItem value="series">TV Series</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" /> Desktop Image URL (Backdrop)
                </Label>
                <Input
                  value={formData.desktop_image_url}
                  onChange={(e) => setFormData({ ...formData, desktop_image_url: e.target.value })}
                  placeholder="https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/..."
                />
                {formData.desktop_image_url && (
                  <img
                    src={formData.desktop_image_url}
                    alt="Desktop Preview"
                    className="w-full h-32 object-cover rounded"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" /> Mobile Image URL (Poster)
                </Label>
                <Input
                  value={formData.mobile_image_url}
                  onChange={(e) => setFormData({ ...formData, mobile_image_url: e.target.value })}
                  placeholder="https://image.tmdb.org/t/p/w500/..."
                />
                {formData.mobile_image_url && (
                  <img
                    src={formData.mobile_image_url}
                    alt="Mobile Preview"
                    className="w-24 h-36 object-cover rounded"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Backgrounds List */}
      <div className="grid gap-4">
        {backgrounds.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No profile backgrounds configured. Add one to get started.
            </CardContent>
          </Card>
        ) : (
          backgrounds.map((bg, index) => (
            <Card key={bg.id} className={!bg.is_active ? "opacity-50" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">#{index + 1}</span>
                    {bg.title}
                    {bg.tmdb_id && (
                      <span className="text-xs text-muted-foreground">(TMDB: {bg.tmdb_id})</span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveBackground(index, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveBackground(index, "down")}
                      disabled={index === backgrounds.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(bg)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(bg.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {bg.desktop_image_url && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Monitor className="h-3 w-3" /> Desktop
                      </p>
                      <img
                        src={bg.desktop_image_url}
                        alt={`${bg.title} desktop`}
                        className="w-48 h-20 object-cover rounded"
                      />
                    </div>
                  )}
                  {bg.mobile_image_url && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Smartphone className="h-3 w-3" /> Mobile
                      </p>
                      <img
                        src={bg.mobile_image_url}
                        alt={`${bg.title} mobile`}
                        className="w-14 h-20 object-cover rounded"
                      />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${bg.is_active ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"}`}>
                    {bg.is_active ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-muted">
                    {bg.content_type}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
