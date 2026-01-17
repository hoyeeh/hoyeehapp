import { useState, useRef } from "react";
import { 
  Gamepad2, Plus, Pencil, Trash2, Check, X, ExternalLink, 
  Globe, AlertTriangle, CheckCircle, HelpCircle, Search, Eye, EyeOff,
  Upload, Link, Loader2, Image as ImageIcon, Store
} from "lucide-react";
import { useAllPlayableGames, useCreatePlayableGame, useUpdatePlayableGame, useDeletePlayableGame, PlayableGame } from "@/hooks/usePlayableGames";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { CrazyGamesSearch } from "./CrazyGamesSearch";

const defaultFormData = {
  title: "",
  description: "",
  thumbnail_url: "",
  embed_url: "",
  source: "CrazyGames",
  embed_type: "iframe" as "iframe" | "external",
  tags: [] as string[],
  age_group: "",
  languages: ["en"],
  subject: "",
  is_verified: false,
  is_active: true,
  display_order: 0,
  health_status: "unknown" as "healthy" | "broken" | "unknown",
};

export const PlayablesManagement = () => {
  const { data: games, isLoading } = useAllPlayableGames();
  const createGame = useCreatePlayableGame();
  const updateGame = useUpdatePlayableGame();
  const deleteGame = useDeletePlayableGame();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<PlayableGame | null>(null);
  const [deleteConfirmGame, setDeleteConfirmGame] = useState<PlayableGame | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(defaultFormData);
  const [tagsInput, setTagsInput] = useState("");
  const [thumbnailMode, setThumbnailMode] = useState<"url" | "upload">("url");
  const [isUploading, setIsUploading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredGames = games?.filter(game =>
    game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    game.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData(defaultFormData);
    setTagsInput("");
    setThumbnailMode("url");
    setPreviewUrl(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (game: PlayableGame) => {
    setFormData({
      title: game.title,
      description: game.description || "",
      thumbnail_url: game.thumbnail_url,
      embed_url: game.embed_url,
      source: game.source,
      embed_type: game.embed_type,
      tags: game.tags || [],
      age_group: game.age_group || "",
      languages: game.languages || ["en"],
      subject: game.subject || "",
      is_verified: game.is_verified,
      is_active: game.is_active,
      display_order: game.display_order,
      health_status: game.health_status,
    });
    setTagsInput((game.tags || []).join(", "));
    setPreviewUrl(game.thumbnail_url);
    setThumbnailMode("url");
    setEditingGame(game);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Allowed: JPG, PNG, GIF, WebP, SVG");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('playable-covers')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('playable-covers')
        .getPublicUrl(fileName);

      setFormData({ ...formData, thumbnail_url: publicUrl });
      setPreviewUrl(publicUrl);
      toast.success("Cover image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAutoFetch = async () => {
    if (!formData.embed_url) {
      toast.error("Please enter an embed URL first");
      return;
    }

    setIsFetching(true);
    try {
      // Try to extract thumbnail from known sources
      let thumbnailUrl = "";

      if (formData.embed_url.includes("crazygames.com")) {
        // Extract game slug from CrazyGames URL
        const match = formData.embed_url.match(/crazygames\.com\/(?:embed\/|game\/)?([^/?]+)/);
        if (match) {
          const gameSlug = match[1];
          thumbnailUrl = `https://images.crazygames.com/${gameSlug}/cover-1.png`;
        }
      } else if (formData.embed_url.includes("withgoogle.com")) {
        // Google Interland-style games
        thumbnailUrl = "https://beinternetawesome.withgoogle.com/images/interland/hero-land-treasure.svg";
      }

      if (thumbnailUrl) {
        setFormData({ ...formData, thumbnail_url: thumbnailUrl });
        setPreviewUrl(thumbnailUrl);
        toast.success("Cover image fetched successfully");
      } else {
        toast.error("Could not auto-fetch cover. Please enter URL manually or upload.");
      }
    } catch (error) {
      toast.error("Failed to fetch cover image");
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.embed_url || !formData.thumbnail_url) {
      toast.error("Please fill in all required fields");
      return;
    }

    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    const gameData = { ...formData, tags };

    try {
      if (editingGame) {
        await updateGame.mutateAsync({ id: editingGame.id, ...gameData });
        toast.success("Game updated successfully");
        setEditingGame(null);
      } else {
        await createGame.mutateAsync(gameData);
        toast.success("Game added successfully");
        setIsAddModalOpen(false);
      }
      resetForm();
    } catch (error) {
      toast.error("Failed to save game");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmGame) return;
    try {
      await deleteGame.mutateAsync(deleteConfirmGame.id);
      toast.success("Game deleted");
      setDeleteConfirmGame(null);
    } catch (error) {
      toast.error("Failed to delete game");
    }
  };

  const handleToggleVerified = async (game: PlayableGame) => {
    try {
      await updateGame.mutateAsync({ id: game.id, is_verified: !game.is_verified });
      toast.success(game.is_verified ? "Game unverified" : "Game verified");
    } catch (error) {
      toast.error("Failed to update game");
    }
  };

  const handleToggleActive = async (game: PlayableGame) => {
    try {
      await updateGame.mutateAsync({ id: game.id, is_active: !game.is_active });
      toast.success(game.is_active ? "Game hidden" : "Game visible");
    } catch (error) {
      toast.error("Failed to update game");
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "broken":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Form content rendered inline to prevent re-mount on state change (fixes typing issue)
  const formContent = (
    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
      <div className="grid gap-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Game title"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="embed_type">Embed Type *</Label>
          <Select
            value={formData.embed_type}
            onValueChange={(v) => setFormData({ ...formData, embed_type: v as "iframe" | "external" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="iframe">Iframe (Embedded)</SelectItem>
              <SelectItem value="external">External Link</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="source">Source *</Label>
          <Select
            value={formData.source}
            onValueChange={(v) => setFormData({ ...formData, source: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CrazyGames">CrazyGames</SelectItem>
              <SelectItem value="Google">Google</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="embed_url">Embed URL *</Label>
        <Input
          id="embed_url"
          value={formData.embed_url}
          onChange={(e) => setFormData(prev => ({ ...prev, embed_url: e.target.value }))}
          placeholder="https://..."
        />
      </div>

      <div className="grid gap-2">
        <Label>Cover Image *</Label>
        <Tabs value={thumbnailMode} onValueChange={(v) => setThumbnailMode(v as "url" | "upload")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url" className="gap-1.5">
              <Link className="h-3.5 w-3.5" />
              URL
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </TabsTrigger>
          </TabsList>
          <TabsContent value="url" className="space-y-2 mt-2">
            <div className="flex gap-2">
              <Input
                value={formData.thumbnail_url}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({ ...prev, thumbnail_url: val }));
                  setPreviewUrl(val);
                }}
                placeholder="https://..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAutoFetch}
                disabled={isFetching || !formData.embed_url}
                title="Auto-fetch from embed URL"
              >
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter URL or click the icon to auto-fetch from embed source
            </p>
          </TabsContent>
          <TabsContent value="upload" className="space-y-2 mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Choose Image
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Supports JPG, PNG, GIF, WebP, SVG (max 5MB)
            </p>
          </TabsContent>
        </Tabs>

        {/* Preview */}
        {previewUrl && (
          <div className="mt-2 relative">
            <img
              src={previewUrl}
              alt="Cover preview"
              className="h-24 w-auto rounded-lg border object-cover"
              onError={() => setPreviewUrl(null)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 bg-background/80"
              onClick={() => {
                setPreviewUrl(null);
                setFormData({ ...formData, thumbnail_url: "" });
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="age_group">Age Group</Label>
          <Input
            id="age_group"
            value={formData.age_group}
            onChange={(e) => setFormData(prev => ({ ...prev, age_group: e.target.value }))}
            placeholder="7+, 7-12, etc."
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
            placeholder="Logic, Safety, etc."
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="logic, fun, puzzle"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="display_order">Display Order</Label>
        <Input
          id="display_order"
          type="number"
          value={formData.display_order}
          onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
        />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id="is_verified"
            checked={formData.is_verified}
            onCheckedChange={(v) => setFormData({ ...formData, is_verified: v })}
          />
          <Label htmlFor="is_verified">Verified</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>
      </div>
    </div>
  );

  const [activeTab, setActiveTab] = useState<"library" | "browse">("library");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Playables Management</h2>
            <p className="text-sm text-muted-foreground">
              Manage games for Hoyeeh Playables section
            </p>
          </div>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Game
        </Button>
      </div>

      {/* Tabs for Library vs Browse */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "library" | "browse")}>
        <TabsList>
          <TabsTrigger value="library" className="gap-2">
            <Gamepad2 className="h-4 w-4" />
            My Library ({games?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="browse" className="gap-2">
            <Store className="h-4 w-4" />
            Browse CrazyGames
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-4">
          <CrazyGamesSearch />
        </TabsContent>

        <TabsContent value="library" className="mt-4 space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search games..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Game</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Plays</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading games...
                </TableCell>
              </TableRow>
            ) : filteredGames?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No games found
                </TableCell>
              </TableRow>
            ) : (
              filteredGames?.map((game) => (
                <TableRow key={game.id}>
                  <TableCell className="font-mono text-xs">
                    {game.display_order}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={game.thumbnail_url}
                        alt={game.title}
                        className="h-10 w-10 rounded object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                      <div>
                        <p className="font-medium">{game.title}</p>
                        {game.tags?.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {game.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-1">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={game.embed_type === "iframe" ? "default" : "outline"}>
                      {game.embed_type === "iframe" ? (
                        <Globe className="h-3 w-3 mr-1" />
                      ) : (
                        <ExternalLink className="h-3 w-3 mr-1" />
                      )}
                      {game.embed_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{game.source}</TableCell>
                  <TableCell>{game.age_group || "-"}</TableCell>
                  <TableCell>{getHealthIcon(game.health_status)}</TableCell>
                  <TableCell>{game.play_count}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleVerified(game)}
                        className={cn(
                          "p-1 rounded",
                          game.is_verified ? "text-green-500" : "text-muted-foreground"
                        )}
                        title={game.is_verified ? "Verified" : "Not verified"}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(game)}
                        className={cn(
                          "p-1 rounded",
                          game.is_active ? "text-foreground" : "text-muted-foreground"
                        )}
                        title={game.is_active ? "Visible" : "Hidden"}
                      >
                        {game.is_active ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(game)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmGame(game)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        </TabsContent>
      </Tabs>

      {/* Add Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              Add New Game
            </DialogTitle>
          </DialogHeader>
          {formContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createGame.isPending}>
              {createGame.isPending ? "Adding..." : "Add Game"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editingGame} onOpenChange={() => setEditingGame(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Game
            </DialogTitle>
          </DialogHeader>
          {formContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGame(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={updateGame.isPending}>
              {updateGame.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmGame} onOpenChange={() => setDeleteConfirmGame(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Game</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmGame?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
