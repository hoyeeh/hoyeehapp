import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllContent } from "@/lib/fetchAllContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, GripVertical, Loader2, LayoutGrid, Eye, EyeOff, Film, Search } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HomeSection {
  id: string;
  title: string;
  section_type: string;
  genre_id: string | null;
  card_style: string;
  card_size: string;
  display_order: number;
  is_active: boolean;
  max_items: number | null;
  allow_duplicates: boolean;
  content_type_filter?: string | null;
  show_on_desktop: boolean;
  show_on_mobile: boolean;
  show_on_kids: boolean;
  is_curated?: boolean;
  year_filter?: number | null;
}

interface Genre {
  id: string;
  name: string;
}

interface PlatformSetting {
  setting_key: string;
  setting_value: string;
}

const SECTION_TYPES = [
  { value: "top10", label: "Top 10" },
  { value: "recently_added", label: "Recently Added" },
  { value: "trending", label: "Trending" },
  { value: "genre", label: "Genre-based" },
  { value: "custom", label: "Custom (All content)" },
  { value: "my_list", label: "My List" },
  { value: "continue_watching", label: "Continue Watching" },
  { value: "leaving_soon", label: "Leaving Soon" },
  { value: "free_content", label: "Free Content" },
  { value: "series", label: "TV Series (by genre and/or year)" },
];

const CONTENT_TYPE_OPTIONS = [
  { value: "all", label: "All (Movies & TV Shows)" },
  { value: "movie", label: "Movies Only" },
  { value: "series", label: "TV Shows Only" },
];

const CARD_STYLES = [
  { value: "poster", label: "Poster (2:3)" },
  { value: "backdrop", label: "Backdrop (16:9)" },
  { value: "wide", label: "Wide (4:3)" },
  { value: "square", label: "Square (1:1)" },
  { value: "minimal", label: "Minimal (text only)" },
];

const CARD_SIZES = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium (Default)" },
  { value: "lg", label: "Large" },
];

interface SortableItemProps {
  section: HomeSection;
  onEdit: (section: HomeSection) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onManageContent?: (section: HomeSection) => void;
}

const SortableItem = ({ section, onEdit, onDelete, onToggleActive, onManageContent }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-secondary/30 rounded-lg ${!section.is_active ? 'opacity-50' : ''}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab hover:text-brand">
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="w-8 h-8 rounded bg-brand/20 flex items-center justify-center text-sm font-medium">
        {section.display_order}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate">{section.title}</h4>
        <p className="text-xs text-muted-foreground">
          {SECTION_TYPES.find(t => t.value === section.section_type)?.label} • {CARD_STYLES.find(s => s.value === section.card_style)?.label} • {CARD_SIZES.find(s => s.value === (section.card_size || 'md'))?.label}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {(section.section_type === "free_content" && section.is_curated) && onManageContent && (
          <Button variant="outline" size="sm" onClick={() => onManageContent(section)}>
            <Film className="h-4 w-4 mr-1" />
            Content
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleActive(section.id, !section.is_active)}
          title={section.is_active ? "Hide section" : "Show section"}
        >
          {section.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onEdit(section)}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(section.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

export const HomeSectionManagement = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSection, setEditingSection] = useState<HomeSection | null>(null);
  const [managingContentSection, setManagingContentSection] = useState<HomeSection | null>(null);
  const [contentSearch, setContentSearch] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    section_type: "genre",
    genre_id: "",
    card_style: "poster",
    card_size: "md",
    max_items: 15,
    is_active: true,
    allow_duplicates: false,
    content_type_filter: "all",
    show_on_desktop: true,
    show_on_mobile: true,
    show_on_kids: false,
    is_curated: false,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ["home-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_sections")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as HomeSection[];
    },
  });

  const { data: genres = [] } = useQuery({
    queryKey: ["genres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("genres").select("*").order("name");
      if (error) throw error;
      return data as Genre[];
    },
  });

  // Fetch global deduplication setting
  const { data: deduplicationSetting } = useQuery({
    queryKey: ["platform-setting-deduplication"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("setting_value")
        .eq("setting_key", "home_enable_deduplication")
        .single();
      if (error) return { setting_value: "true" };
      return data;
    },
  });

  const enableDeduplication = deduplicationSetting?.setting_value !== "false";

  const createSection = useMutation({
    mutationFn: async (data: typeof formData) => {
      const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.display_order)) : 0;
      const { error } = await supabase.from("home_sections").insert({
        title: data.title,
        section_type: data.section_type,
        genre_id: data.genre_id || null,
        card_style: data.card_style,
        card_size: data.card_size,
        max_items: data.max_items,
        is_active: data.is_active,
        display_order: maxOrder + 1,
        allow_duplicates: data.allow_duplicates,
        content_type_filter: data.content_type_filter === "all" ? null : data.content_type_filter,
        show_on_desktop: data.show_on_desktop,
        show_on_mobile: data.show_on_mobile,
        show_on_kids: data.show_on_kids,
        is_curated: data.is_curated,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
      resetForm();
      toast.success("Section added");
    },
    onError: () => toast.error("Failed to add section"),
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & typeof formData) => {
      const { error } = await supabase.from("home_sections").update({
        title: data.title,
        section_type: data.section_type,
        genre_id: data.genre_id || null,
        card_style: data.card_style,
        card_size: data.card_size,
        max_items: data.max_items,
        is_active: data.is_active,
        allow_duplicates: data.allow_duplicates,
        content_type_filter: data.content_type_filter === "all" ? null : data.content_type_filter,
        show_on_desktop: data.show_on_desktop,
        show_on_mobile: data.show_on_mobile,
        show_on_kids: data.show_on_kids,
        is_curated: data.is_curated,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
      resetForm();
      toast.success("Section updated");
    },
    onError: () => toast.error("Failed to update section"),
  });

  // Toggle global deduplication setting
  const toggleDeduplication = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("platform_settings")
        .upsert({
          setting_key: "home_enable_deduplication",
          setting_value: enabled ? "true" : "false",
          description: "Enable content deduplication across home page sections",
        }, { onConflict: "setting_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-setting-deduplication"] });
      toast.success("Deduplication setting updated");
    },
    onError: () => toast.error("Failed to update setting"),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("home_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
      toast.success("Section deleted");
    },
    onError: () => toast.error("Failed to delete section"),
  });

  const reorderSections = useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      for (const update of updates) {
        await supabase.from("home_sections").update({ display_order: update.display_order }).eq("id", update.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
    },
    onError: () => toast.error("Failed to reorder sections"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("home_sections").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
    },
  });

  // Fetch all content for curated selection
  const { data: allContent = [] } = useQuery({
    queryKey: ["all-content-for-sections"],
    queryFn: async () => {
      return await fetchAllContent(
        "id, title, thumbnail_url, content_type, is_premium, year",
        (q) => q.order("created_at", { ascending: false })
      );
    },
    enabled: !!managingContentSection,
  });

  // Fetch curated content for the section being managed
  const { data: sectionContent = [] } = useQuery({
    queryKey: ["section-content", managingContentSection?.id],
    queryFn: async () => {
      if (!managingContentSection) return [];
      const { data, error } = await supabase
        .from("section_content")
        .select("*, content:content_id(id, title, thumbnail_url, content_type)")
        .eq("section_id", managingContentSection.id)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!managingContentSection,
  });

  const addContentToSection = useMutation({
    mutationFn: async ({ sectionId, contentId }: { sectionId: string; contentId: string }) => {
      const maxOrder = sectionContent.length > 0 ? Math.max(...sectionContent.map((s: any) => s.display_order || 0)) : 0;
      const { error } = await supabase.from("section_content").insert({
        section_id: sectionId,
        content_id: contentId,
        display_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-content", managingContentSection?.id] });
      toast.success("Content added");
    },
    onError: () => toast.error("Failed to add content"),
  });

  const removeContentFromSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("section_content").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-content", managingContentSection?.id] });
      toast.success("Content removed");
    },
    onError: () => toast.error("Failed to remove content"),
  });

  // Filter available content for curated selection
  const availableContent = allContent.filter((c: any) => {
    const matchesSearch = c.title.toLowerCase().includes(contentSearch.toLowerCase());
    const notAlreadyAdded = !sectionContent.some((sc: any) => sc.content_id === c.id);
    const isFree = !c.is_premium;
    // Apply content type filter if set
    const matchesType = !managingContentSection?.content_type_filter || 
      managingContentSection.content_type_filter === "all" ||
      c.content_type === managingContentSection.content_type_filter;
    return matchesSearch && notAlreadyAdded && isFree && matchesType;
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    const newOrder = arrayMove(sections, oldIndex, newIndex);

    const updates = newOrder.map((section, index) => ({
      id: section.id,
      display_order: index + 1,
    }));

    reorderSections.mutate(updates);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingSection(null);
    setFormData({
      title: "",
      section_type: "genre",
      genre_id: "",
      card_style: "poster",
      card_size: "md",
      max_items: 15,
      is_active: true,
      allow_duplicates: false,
      content_type_filter: "all",
      show_on_desktop: true,
      show_on_mobile: true,
      show_on_kids: false,
      is_curated: false,
    });
  };

  const handleEdit = (section: HomeSection) => {
    setEditingSection(section);
    setFormData({
      title: section.title,
      section_type: section.section_type,
      genre_id: section.genre_id || "",
      card_style: section.card_style,
      card_size: section.card_size || "md",
      max_items: section.max_items || 15,
      is_active: section.is_active,
      allow_duplicates: section.allow_duplicates || false,
      content_type_filter: section.content_type_filter || "all",
      show_on_desktop: section.show_on_desktop ?? true,
      show_on_mobile: section.show_on_mobile ?? true,
      show_on_kids: section.show_on_kids ?? false,
      is_curated: section.is_curated ?? false,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Please enter a section title");
      return;
    }
    if (editingSection) {
      updateSection.mutate({ id: editingSection.id, ...formData });
    } else {
      createSection.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this section?")) {
      deleteSection.mutate(id);
    }
  };

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-brand" />
          Home Page Sections
        </CardTitle>
        <CardDescription>
          Manage and reorder sections displayed on the home page. Drag to reorder.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Global Deduplication Toggle */}
        <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
          <div>
            <h4 className="font-medium">Content Deduplication</h4>
            <p className="text-sm text-muted-foreground">
              Prevent the same content from appearing in multiple sections
            </p>
          </div>
          <Switch
            checked={enableDeduplication}
            onCheckedChange={(checked) => toggleDeduplication.mutate(checked)}
            disabled={toggleDeduplication.isPending}
          />
        </div>

        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Section
        </Button>

        {/* Section Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSection ? "Edit Section" : "Add Section"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Section title..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Section Type</Label>
                  <Select value={formData.section_type} onValueChange={(v) => setFormData({ ...formData, section_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SECTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Card Style</Label>
                  <Select value={formData.card_style} onValueChange={(v) => setFormData({ ...formData, card_style: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CARD_STYLES.map((style) => (
                        <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Card Size</Label>
                  <Select value={formData.card_size} onValueChange={(v) => setFormData({ ...formData, card_size: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CARD_SIZES.map((size) => (
                        <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formData.section_type === "genre" && (
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select value={formData.genre_id} onValueChange={(v) => setFormData({ ...formData, genre_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select genre..." /></SelectTrigger>
                    <SelectContent>
                      {genres.map((genre) => (
                        <SelectItem key={genre.id} value={genre.id}>{genre.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formData.section_type === "free_content" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Content Type Filter</Label>
                    <Select value={formData.content_type_filter} onValueChange={(v) => setFormData({ ...formData, content_type_filter: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONTENT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                    <Switch
                      checked={formData.is_curated}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_curated: checked })}
                    />
                    <div>
                      <Label>Curated Selection</Label>
                      <p className="text-xs text-muted-foreground">Manually select specific content (save first, then use "Content" button)</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Max Items</Label>
                <Input
                  type="number"
                  value={formData.max_items}
                  onChange={(e) => setFormData({ ...formData, max_items: parseInt(e.target.value) || 15 })}
                  min={1}
                  max={50}
                />
              </div>
              
              {/* Display Target Options */}
              <div className="space-y-3 p-3 bg-secondary/20 rounded-lg">
                <Label className="text-sm font-medium">Display On</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.show_on_desktop}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_on_desktop: checked })}
                    />
                    <Label className="text-sm">Desktop</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.show_on_mobile}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_on_mobile: checked })}
                    />
                    <Label className="text-sm">Mobile</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.show_on_kids}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_on_kids: checked })}
                    />
                    <Label className="text-sm">Kids</Label>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.allow_duplicates}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_duplicates: checked })}
                />
                <div>
                  <Label>Allow Duplicates</Label>
                  <p className="text-xs text-muted-foreground">Content in this section can appear in other sections</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={createSection.isPending || updateSection.isPending}>
                  {(createSection.isPending || updateSection.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingSection ? "Update" : "Add"} Section
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Content Management Dialog for Curated Free Content */}
        <Dialog open={!!managingContentSection} onOpenChange={(open) => !open && setManagingContentSection(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Manage Content: {managingContentSection?.title}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 h-[60vh]">
              {/* Selected Content */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Selected Content ({sectionContent.length})</Label>
                <ScrollArea className="h-[50vh] border rounded-lg p-2">
                  {sectionContent.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No content selected</p>
                  ) : (
                    <div className="space-y-2">
                      {sectionContent.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                          <img 
                            src={item.content?.thumbnail_url || "/placeholder.svg"} 
                            alt={item.content?.title} 
                            className="w-12 h-8 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.content?.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{item.content?.content_type}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeContentFromSection.mutate(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
              
              {/* Available Content */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Available Free Content</Label>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search content..."
                    value={contentSearch}
                    onChange={(e) => setContentSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="h-[45vh] border rounded-lg p-2">
                  <div className="space-y-2">
                    {availableContent.slice(0, 50).map((item: any) => (
                      <div 
                        key={item.id} 
                        className="flex items-center gap-2 p-2 bg-secondary/20 rounded-lg hover:bg-secondary/40 cursor-pointer transition-colors"
                        onClick={() => managingContentSection && addContentToSection.mutate({ 
                          sectionId: managingContentSection.id, 
                          contentId: item.id 
                        })}
                      >
                        <img 
                          src={item.thumbnail_url || "/placeholder.svg"} 
                          alt={item.title} 
                          className="w-12 h-8 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.content_type} • {item.year}</p>
                        </div>
                        <Plus className="h-4 w-4 text-brand" />
                      </div>
                    ))}
                    {availableContent.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {contentSearch ? "No matching content found" : "No free content available"}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sections List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : sections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No sections yet. Add your first section above.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sections.map((section) => (
                  <SortableItem
                    key={section.id}
                    section={section}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={(id, active) => toggleActive.mutate({ id, is_active: active })}
                    onManageContent={setManagingContentSection}
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
