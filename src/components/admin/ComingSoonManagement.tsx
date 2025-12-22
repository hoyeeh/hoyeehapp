import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Edit2, Trash2, Calendar, Loader2, Send, Search, Film, Tv, Check, ListPlus, RefreshCw, Clock, History, Users, Bell } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface TMDBResult {
  tmdb_id: number;
  title: string;
  description: string;
  content_type: string;
  genre: string;
  thumbnail_url: string | null;
  backdrop_url: string | null;
  trailer_url: string | null;
  release_date: string | null;
  rating: string | null;
  popularity: number;
}

export const ComingSoonManagement = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("import");
  const [viewTab, setViewTab] = useState<"upcoming" | "history">("upcoming");
  
  // TMDB Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"movie" | "tv">("movie");
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<TMDBResult | null>(null);
  
  // Bulk import state
  const [selectedForBulk, setSelectedForBulk] = useState<Set<number>>(new Set());
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    processed: number;
    notified: number;
    timestamp: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    thumbnail_url: "",
    backdrop_url: "",
    trailer_url: "",
    content_type: "movie",
    genre: "",
    expected_release_date: "",
    is_active: true,
    tmdb_id: null as number | null,
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

  // Fetch sync history
  const { data: syncHistory = [], isLoading: isLoadingSyncHistory } = useQuery({
    queryKey: ["admin-coming-soon-sync-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coming_soon_sync_log")
        .select("*")
        .order("synced_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // TMDB Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setIsSearching(true);
    setSelectedResult(null);
    setSelectedForBulk(new Set());
    
    try {
      const { data, error } = await supabase.functions.invoke("tmdb-coming-soon-search", {
        body: { query: searchQuery, type: searchType },
      });

      if (error) throw error;
      setSearchResults(data.results || []);
      
      if (data.results?.length === 0) {
        toast.info("No results found");
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Search failed: " + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const selectTMDBResult = (result: TMDBResult) => {
    setSelectedResult(result);
    setFormData({
      title: result.title,
      description: result.description,
      thumbnail_url: result.thumbnail_url || "",
      backdrop_url: result.backdrop_url || "",
      trailer_url: result.trailer_url || "",
      content_type: result.content_type,
      genre: result.genre,
      expected_release_date: result.release_date || "",
      is_active: true,
      tmdb_id: result.tmdb_id,
    });
  };

  const toggleBulkSelection = (tmdbId: number) => {
    const newSelection = new Set(selectedForBulk);
    if (newSelection.has(tmdbId)) {
      newSelection.delete(tmdbId);
    } else {
      newSelection.add(tmdbId);
    }
    setSelectedForBulk(newSelection);
  };

  const selectAllForBulk = () => {
    if (selectedForBulk.size === searchResults.length) {
      setSelectedForBulk(new Set());
    } else {
      setSelectedForBulk(new Set(searchResults.map(r => r.tmdb_id)));
    }
  };

  // Bulk import mutation
  const handleBulkImport = async () => {
    if (selectedForBulk.size === 0) {
      toast.error("Select at least one item to import");
      return;
    }

    setIsBulkImporting(true);
    try {
      const itemsToImport = searchResults.filter(r => selectedForBulk.has(r.tmdb_id));
      
      const insertData = itemsToImport.map(result => ({
        title: result.title,
        description: result.description || null,
        thumbnail_url: result.thumbnail_url || null,
        backdrop_url: result.backdrop_url || null,
        trailer_url: result.trailer_url || null,
        content_type: result.content_type,
        genre: result.genre || null,
        expected_release_date: result.release_date || null,
        is_active: true,
        tmdb_id: result.tmdb_id,
      }));

      const { error } = await supabase.from("coming_soon").insert(insertData);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin-coming-soon"] });
      toast.success(`Imported ${insertData.length} items!`);
      resetForm();
    } catch (error: any) {
      console.error("Bulk import error:", error);
      toast.error("Failed to import: " + error.message);
    } finally {
      setIsBulkImporting(false);
    }
  };

  // Create mutation
  const createItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("coming_soon").insert({
        title: formData.title,
        description: formData.description || null,
        thumbnail_url: formData.thumbnail_url || null,
        backdrop_url: formData.backdrop_url || null,
        trailer_url: formData.trailer_url || null,
        content_type: formData.content_type,
        genre: formData.genre || null,
        expected_release_date: formData.expected_release_date || null,
        is_active: formData.is_active,
        tmdb_id: formData.tmdb_id,
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
          title: formData.title,
          description: formData.description || null,
          thumbnail_url: formData.thumbnail_url || null,
          backdrop_url: formData.backdrop_url || null,
          trailer_url: formData.trailer_url || null,
          content_type: formData.content_type,
          genre: formData.genre || null,
          expected_release_date: formData.expected_release_date || null,
          is_active: formData.is_active,
          tmdb_id: formData.tmdb_id,
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

  // Release notification mutation
  const sendReleaseNotification = useMutation({
    mutationFn: async (item: any) => {
      const { data, error } = await supabase.functions.invoke("notify-coming-soon-release", {
        body: {
          comingSoonId: item.id,
          contentId: null,
          title: item.title,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Notified ${data.notifiedUsers} users about the release!`);
    },
    onError: () => {
      toast.error("Failed to send release notifications");
    },
  });

  // Manual sync function
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-coming-soon-releases");
      
      if (error) throw error;
      
      if (data.processed > 0) {
        queryClient.invalidateQueries({ queryKey: ["admin-coming-soon"] });
        toast.success(`Synced ${data.processed} items, notified ${data.notified} users`);
      } else {
        toast.info("No new releases to sync");
      }
      
      setLastSyncResult({
        processed: data.processed,
        notified: data.notified,
        timestamp: data.timestamp,
      });
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error("Sync failed: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      thumbnail_url: "",
      backdrop_url: "",
      trailer_url: "",
      content_type: "movie",
      genre: "",
      expected_release_date: "",
      is_active: true,
      tmdb_id: null,
    });
    setEditingItem(null);
    setIsDialogOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedResult(null);
    setSelectedForBulk(new Set());
    setActiveTab("import");
  };

  const openEditDialog = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      thumbnail_url: item.thumbnail_url || "",
      backdrop_url: item.backdrop_url || "",
      trailer_url: item.trailer_url || "",
      content_type: item.content_type,
      genre: item.genre || "",
      expected_release_date: item.expected_release_date || "",
      is_active: item.is_active,
      tmdb_id: item.tmdb_id || null,
    });
    setActiveTab("manual");
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
            <Calendar className="h-6 w-6 text-primary" />
            Coming Soon Management
          </h2>
          <p className="text-muted-foreground">
            Manage upcoming movies and TV shows
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync Status & Button */}
          <div className="flex items-center gap-2">
            {lastSyncResult && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last sync: {format(new Date(lastSyncResult.timestamp), "h:mm a")}
                {lastSyncResult.processed > 0 && (
                  <span className="text-green-500 ml-1">
                    ({lastSyncResult.processed} synced)
                  </span>
                )}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync Now
            </Button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Coming Soon
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Coming Soon" : "Add Coming Soon"}
              </DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="import" className="gap-2">
                  <Search className="h-4 w-4" />
                  Import from TMDB
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-2">
                  <Edit2 className="h-4 w-4" />
                  Manual Entry
                </TabsTrigger>
              </TabsList>

              <TabsContent value="import" className="space-y-4 mt-4">
                {/* Search Controls */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Search for a movie or TV show..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                  </div>
                  <Select value={searchType} onValueChange={(v: "movie" | "tv") => setSearchType(v)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="movie">
                        <div className="flex items-center gap-2">
                          <Film className="h-4 w-4" /> Movie
                        </div>
                      </SelectItem>
                      <SelectItem value="tv">
                        <div className="flex items-center gap-2">
                          <Tv className="h-4 w-4" /> TV Show
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Bulk Import Controls */}
                {searchResults.length > 0 && (
                  <div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedForBulk.size === searchResults.length && searchResults.length > 0}
                        onCheckedChange={selectAllForBulk}
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedForBulk.size} selected
                      </span>
                    </div>
                    {selectedForBulk.size > 0 && (
                      <Button
                        size="sm"
                        onClick={handleBulkImport}
                        disabled={isBulkImporting}
                        className="gap-2"
                      >
                        {isBulkImporting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ListPlus className="h-4 w-4" />
                        )}
                        Import {selectedForBulk.size} Items
                      </Button>
                    )}
                  </div>
                )}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
                    {searchResults.map((result) => (
                      <div
                        key={result.tmdb_id}
                        className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                          selectedResult?.tmdb_id === result.tmdb_id
                            ? "border-primary ring-2 ring-primary/50"
                            : selectedForBulk.has(result.tmdb_id)
                            ? "border-primary/50"
                            : "border-transparent hover:border-muted-foreground/50"
                        }`}
                      >
                        {/* Bulk Selection Checkbox */}
                        <div
                          className="absolute top-2 left-2 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBulkSelection(result.tmdb_id);
                          }}
                        >
                          <Checkbox
                            checked={selectedForBulk.has(result.tmdb_id)}
                            className="bg-black/50 border-white"
                          />
                        </div>
                        
                        <div onClick={() => selectTMDBResult(result)}>
                          {result.thumbnail_url ? (
                            <img
                              src={result.thumbnail_url}
                              alt={result.title}
                              className="w-full h-32 object-cover"
                            />
                          ) : (
                            <div className="w-full h-32 bg-muted flex items-center justify-center">
                              <Film className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-xs font-medium text-white line-clamp-2">{result.title}</p>
                            {result.release_date && (
                              <p className="text-xs text-white/70">{result.release_date.split("-")[0]}</p>
                            )}
                          </div>
                          {selectedResult?.tmdb_id === result.tmdb_id && (
                            <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Result Preview */}
                {selectedResult && (
                  <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
                    <h4 className="font-semibold text-sm text-muted-foreground">Selected Content</h4>
                    <div className="flex gap-4">
                      {selectedResult.thumbnail_url && (
                        <img
                          src={selectedResult.thumbnail_url}
                          alt={selectedResult.title}
                          className="w-20 h-28 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold">{formData.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{formData.content_type} • {formData.genre}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{formData.description}</p>
                        {formData.trailer_url && (
                          <p className="text-xs text-primary">✓ Trailer available</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Editable fields for imported content */}
                    <div className="space-y-3 pt-2 border-t">
                      <div className="space-y-2">
                        <Label>Expected Release Date</Label>
                        <Input
                          type="date"
                          value={formData.expected_release_date}
                          onChange={(e) => setFormData({ ...formData, expected_release_date: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                        <Label>Active</Label>
                      </div>
                    </div>
                  </div>
                )}

                {selectedResult && (
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSubmit} disabled={createItem.isPending}>
                      {createItem.isPending ? "Saving..." : "Add to Coming Soon"}
                    </Button>
                    <Button variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Title"
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

                <div className="grid grid-cols-2 gap-4">
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
                        <SelectItem value="series">TV Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Genre</Label>
                    <Input
                      value={formData.genre}
                      onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                      placeholder="Action, Drama..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Expected Release Date</Label>
                  <Input
                    type="date"
                    value={formData.expected_release_date}
                    onChange={(e) => setFormData({ ...formData, expected_release_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Thumbnail URL (Poster)</Label>
                  <Input
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Backdrop URL (Cover)</Label>
                  <Input
                    value={formData.backdrop_url}
                    onChange={(e) => setFormData({ ...formData, backdrop_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Trailer URL</Label>
                  <Input
                    value={formData.trailer_url}
                    onChange={(e) => setFormData({ ...formData, trailer_url: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
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
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as "upcoming" | "history")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="upcoming" className="gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming ({items.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Sync History ({syncHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.thumbnail_url && (
                          <img src={item.thumbnail_url} alt="" className="w-8 h-12 object-cover rounded" />
                        )}
                        {item.title}
                      </div>
                    </TableCell>
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
                          onClick={() => sendReleaseNotification.mutate(item)}
                          title="Send release notification"
                          disabled={sendReleaseNotification.isPending}
                        >
                          <Send className="h-4 w-4 text-primary" />
                        </Button>
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
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {isLoadingSyncHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : syncHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No sync history yet.</p>
              <p className="text-sm">Items will appear here when they're automatically synced to the content library.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Synced</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Notified
                    </div>
                  </TableHead>
                  <TableHead>TMDB ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncHistory.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.title}</TableCell>
                    <TableCell className="capitalize">{log.content_type}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {format(new Date(log.synced_at), "MMM d, yyyy")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.synced_at), { addSuffix: true })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.users_notified > 0 ? (
                        <div className="flex items-center gap-1 text-green-500">
                          <Bell className="h-4 w-4" />
                          <span>{log.users_notified}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.tmdb_id ? (
                        <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                          {log.tmdb_id}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
