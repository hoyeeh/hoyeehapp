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
import { Plus, Trash2, Edit2, GripVertical, Loader2, LayoutGrid, Eye, EyeOff, Film, Search, X, Monitor, Smartphone, Baby } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface HomeSection {
  id: string;
  title: string;
  section_type: string;
  genre_id: string | null;
  card_style: string;
  display_order: number;
  is_active: boolean;
  max_items: number | null;
  content_type_filter?: string;
  show_on_desktop: boolean;
  show_on_mobile: boolean;
  show_on_kids: boolean;
  is_curated: boolean;
  allow_duplicates: boolean;
  year_filter?: number | null;
  year_min?: number | null;
  year_max?: number | null;
  first_card_style?: string;
  section_banner_url?: string;
  featured_content_id?: string;
}

interface Content {
  id: string;
  title: string;
  thumbnail_url: string | null;
  content_type: string;
  year: number | null;
}

const SECTION_TYPES = [
  { value: "top10", label: "Top 10" },
  { value: "new_releases", label: "New Releases (Last 2 weeks)" },
  { value: "recently_added", label: "Recently Added" },
  { value: "trending", label: "Trending" },
  { value: "genre", label: "Genre-based" },
  { value: "curated", label: "Curated (Select specific content)" },
  { value: "free_content", label: "Free Content" },
  { value: "youtube", label: "YouTube Videos" },
  { value: "custom", label: "Custom (All content)" },
  { value: "my_list", label: "My List" },
  { value: "continue_watching", label: "Continue Watching" },
  { value: "creator_store", label: "Hoyeeh Studio (Paid Content)" },
  { value: "by_year", label: "By Year (Movies by release year)" },
  { value: "series", label: "TV Series (by genre and/or year)" },
  { value: "playables", label: "Hoyeeh Playables (Games)" },
  { value: "leaving_soon", label: "Leaving Soon" },
  // Personalized sections (auto-populated based on user data)
  { value: "recently_watched", label: "Recently Watched (Completed)" },
  { value: "because_you_watched", label: "Because You Watched" },
  { value: "ai_recommendations", label: "AI Hoyeeh Picks" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "recommendations", label: "Recommended For You" },
  { value: "purchases", label: "My Purchases (Mobile)" },
];

const CARD_STYLES = [
  { value: "poster", label: "Poster (2:3)" },
  { value: "backdrop", label: "Backdrop (16:9)" },
  { value: "wide", label: "Wide (4:3)" },
  { value: "square", label: "Square (1:1)" },
  { value: "minimal", label: "Minimal (text only)" },
  { value: "full", label: "Full Cover (3:4)" },
];

const FIRST_CARD_STYLES = [
  { value: "backdrop", label: "Backdrop (16:9)" },
  { value: "full", label: "Full Cover (3:4)" },
  { value: "poster", label: "Poster (2:3)" },
];

const sanitizeYearFilters = (data: {
  year_filter: number | null;
  year_min: number | null;
  year_max: number | null;
}) => {
  const exactYear = typeof data.year_filter === "number" && !Number.isNaN(data.year_filter)
    ? data.year_filter
    : null;

  if (exactYear) {
    return {
      year_filter: exactYear,
      year_min: null,
      year_max: null,
    };
  }

  const minYear = typeof data.year_min === "number" && !Number.isNaN(data.year_min)
    ? data.year_min
    : null;
  const maxYear = typeof data.year_max === "number" && !Number.isNaN(data.year_max)
    ? data.year_max
    : null;

  if (minYear !== null && maxYear !== null && minYear > maxYear) {
    return {
      year_filter: null,
      year_min: maxYear,
      year_max: minYear,
    };
  }

  return {
    year_filter: null,
    year_min: minYear,
    year_max: maxYear,
  };
};

interface SortableItemProps {
  section: HomeSection;
  onEdit: (section: HomeSection) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onManageContent: (section: HomeSection) => void;
}

const SortableItem = ({ section, onEdit, onDelete, onToggleActive, onManageContent }: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-secondary/30 rounded-lg ${!section.is_active ? "opacity-50" : ""}`}
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
          {SECTION_TYPES.find((t) => t.value === section.section_type)?.label} •{" "}
          {CARD_STYLES.find((s) => s.value === section.card_style)?.label}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {(section.section_type === "curated" || (section.section_type === "free_content" && section.is_curated)) && (
          <Button variant="outline" size="sm" onClick={() => onManageContent(section)}>
            <Film className="h-4 w-4 mr-1" />
            Content
          </Button>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {section.show_on_desktop && <span title="Desktop"><Monitor className="h-3 w-3" /></span>}
          {section.show_on_mobile && <span title="Mobile"><Smartphone className="h-3 w-3" /></span>}
          {section.show_on_kids && <span title="Kids"><Baby className="h-3 w-3" /></span>}
        </div>
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

export const EnhancedHomeSectionManagement = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSection, setEditingSection] = useState<HomeSection | null>(null);
  const [managingContentSection, setManagingContentSection] = useState<HomeSection | null>(null);
  const [contentSearch, setContentSearch] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    title: "",
    section_type: "genre",
    genre_id: "",
    card_style: "poster",
    max_items: 15,
    is_active: true,
    content_type_filter: "all" as "all" | "movie" | "series",
    show_on_desktop: true,
    show_on_mobile: true,
    show_on_kids: false,
    is_curated: false,
    year_filter: null as number | null,
    year_min: null as number | null,
    year_max: null as number | null,
    first_card_style: "backdrop" as "backdrop" | "full" | "poster",
    section_banner_url: "",
    featured_content_id: "",
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
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return data as HomeSection[];
    },
  });

  const { data: genres = [] } = useQuery({
    queryKey: ["genres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("genres").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allContent = [] } = useQuery({
    queryKey: ["all-content"],
    queryFn: async () => {
      return await fetchAllContent<Content & { is_premium: boolean | null }>(
        "id, title, thumbnail_url, content_type, year, is_premium",
        (q) => q.order("title")
      );
    },
  });

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
      return data;
    },
    enabled: !!managingContentSection,
  });

  const createSection = useMutation({
    mutationFn: async (data: typeof formData) => {
      const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.display_order)) : 0;
      const { year_filter, year_min, year_max } = sanitizeYearFilters(data);
      const { error } = await supabase.from("home_sections").insert({
        title: data.title,
        section_type: data.section_type,
        genre_id: data.genre_id || null,
        card_style: data.card_style,
        max_items: data.max_items,
        is_active: data.is_active,
        display_order: maxOrder + 1,
        content_type_filter: data.content_type_filter,
        show_on_desktop: data.show_on_desktop,
        show_on_mobile: data.show_on_mobile,
        show_on_kids: data.show_on_kids,
        is_curated: data.section_type === "free_content" ? data.is_curated : data.section_type === "curated",
        year_filter,
        year_min,
        year_max,
        first_card_style: data.section_type === "new_releases" ? data.first_card_style : null,
        section_banner_url: data.section_banner_url || null,
        featured_content_id: data.section_type === "new_releases" && data.featured_content_id ? data.featured_content_id : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
      queryClient.invalidateQueries({ queryKey: ["home-sections-display"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-home-sections"] });
      resetForm();
      toast.success("Section added");
    },
    onError: () => toast.error("Failed to add section"),
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & typeof formData) => {
      const { year_filter, year_min, year_max } = sanitizeYearFilters(data);
      const { error } = await supabase
        .from("home_sections")
        .update({
          title: data.title,
          section_type: data.section_type,
          genre_id: data.genre_id || null,
          card_style: data.card_style,
          max_items: data.max_items,
          is_active: data.is_active,
          content_type_filter: data.content_type_filter,
          show_on_desktop: data.show_on_desktop,
          show_on_mobile: data.show_on_mobile,
          show_on_kids: data.show_on_kids,
          is_curated: data.section_type === "free_content" ? data.is_curated : data.section_type === "curated",
          year_filter,
          year_min,
          year_max,
          first_card_style: data.section_type === "new_releases" ? data.first_card_style : null,
          section_banner_url: data.section_banner_url || null,
          featured_content_id: data.section_type === "new_releases" && data.featured_content_id ? data.featured_content_id : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
      queryClient.invalidateQueries({ queryKey: ["home-sections-display"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-home-sections"] });
      resetForm();
      toast.success("Section updated");
    },
    onError: () => toast.error("Failed to update section"),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("home_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
      queryClient.invalidateQueries({ queryKey: ["home-sections-display"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-home-sections"] });
      toast.success("Section deleted");
    },
    onError: () => toast.error("Failed to delete section"),
  });

  const addContentToSection = useMutation({
    mutationFn: async ({ sectionId, contentId }: { sectionId: string; contentId: string }) => {
      const maxOrder = sectionContent.length > 0 ? Math.max(...sectionContent.map((s: any) => s.display_order)) : 0;
      const { error } = await supabase.from("section_content").insert({
        section_id: sectionId,
        content_id: contentId,
        display_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["section-content", managingContentSection?.id] });
      toast.success("Content added to section");
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
      toast.success("Content removed from section");
    },
    onError: () => toast.error("Failed to remove content"),
  });

  const reorderSections = useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      // Parallel updates: faster and minimizes partial-failure window.
      const results = await Promise.all(
        updates.map((u) =>
          supabase.from("home_sections").update({ display_order: u.display_order }).eq("id", u.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["home-sections"] });
      const previous = queryClient.getQueryData<HomeSection[]>(["home-sections"]);
      if (previous) {
        const orderMap = new Map(updates.map((u) => [u.id, u.display_order]));
        const next = [...previous]
          .map((s) => ({ ...s, display_order: orderMap.get(s.id) ?? s.display_order }))
          .sort((a, b) => a.display_order - b.display_order);
        queryClient.setQueryData(["home-sections"], next);
      }
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
      queryClient.invalidateQueries({ queryKey: ["home-sections-display"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-home-sections"] });
      toast.success("Section order updated");
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(["home-sections"], ctx.previous);
      toast.error("Failed to reorder sections");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("home_sections").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-sections"] });
      queryClient.invalidateQueries({ queryKey: ["home-sections-display"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-home-sections"] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
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
      max_items: 15,
      is_active: true,
      content_type_filter: "all",
      show_on_desktop: true,
      show_on_mobile: true,
      show_on_kids: false,
      is_curated: false,
      year_filter: null,
      year_min: null,
      year_max: null,
      first_card_style: "backdrop",
      section_banner_url: "",
      featured_content_id: "",
    });
  };

  const handleEdit = (section: HomeSection) => {
    setEditingSection(section);
    setFormData({
      title: section.title,
      section_type: section.section_type,
      genre_id: section.genre_id || "",
      card_style: section.card_style,
      max_items: section.max_items || 15,
      is_active: section.is_active,
      content_type_filter: (section.content_type_filter as "all" | "movie" | "series") || "all",
      show_on_desktop: section.show_on_desktop ?? true,
      show_on_mobile: section.show_on_mobile ?? true,
      show_on_kids: section.show_on_kids ?? false,
      is_curated: section.is_curated ?? false,
      year_filter: section.year_filter ?? null,
      year_min: (section as any).year_min ?? null,
      year_max: (section as any).year_max ?? null,
      first_card_style: (section.first_card_style as "backdrop" | "full" | "poster") || "backdrop",
      section_banner_url: section.section_banner_url || "",
      featured_content_id: section.featured_content_id || "",
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

  const filteredContent = allContent.filter((c) => {
    const matchesSearch = c.title.toLowerCase().includes(contentSearch.toLowerCase());
    const matchesType = contentTypeFilter === "all" || c.content_type === contentTypeFilter;
    const notAlreadyAdded = !sectionContent.some((sc: any) => sc.content_id === c.id);
    // For free_content sections, only show free content (is_premium = false or null)
    const isFreeContentSection = managingContentSection?.section_type === "free_content";
    const matchesFreeContent = !isFreeContentSection || !c.is_premium;
    return matchesSearch && matchesType && notAlreadyAdded && matchesFreeContent;
  });

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-brand" />
          Home Page Sections
        </CardTitle>
        <CardDescription>
          Manage sections on the home page. Use "Curated" type to add specific movies/shows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              </div>
              {formData.section_type === "genre" && (
                <div className="space-y-2">
                  <Label>Genre</Label>
                  <Select value={formData.genre_id} onValueChange={(v) => setFormData({ ...formData, genre_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select genre..." /></SelectTrigger>
                    <SelectContent>
                      {genres.filter((genre: any) => genre.id).map((genre: any) => (
                        <SelectItem key={genre.id} value={genre.id}>{genre.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formData.section_type === "new_releases" && (
                <>
                  <div className="space-y-2">
                    <Label>Content Type Filter</Label>
                    <Select 
                      value={formData.content_type_filter} 
                      onValueChange={(v) => setFormData({ ...formData, content_type_filter: v as "all" | "movie" | "series" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Content</SelectItem>
                        <SelectItem value="movie">Movies Only</SelectItem>
                        <SelectItem value="series">TV Shows Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>First Card Style</Label>
                    <Select 
                      value={formData.first_card_style} 
                      onValueChange={(v) => setFormData({ ...formData, first_card_style: v as "backdrop" | "full" | "poster" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIRST_CARD_STYLES.map((style) => (
                          <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Controls the style of the first (featured) card</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Featured Content (optional)</Label>
                    <Select 
                      value={formData.featured_content_id || "__none__"} 
                      onValueChange={(v) => setFormData({ ...formData, featured_content_id: v === "__none__" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select featured content..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Auto (most recent)</SelectItem>
                        {allContent.slice(0, 50).map((content) => (
                          <SelectItem key={content.id} value={content.id}>
                            {content.title} ({content.year || "N/A"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Pin a specific content item as the first card</p>
                  </div>
                </>
              )}

              {/* Section Banner URL - Available for all section types */}
              <div className="space-y-2">
                <Label>Section Banner URL (optional)</Label>
                <Input
                  value={formData.section_banner_url}
                  onChange={(e) => setFormData({ ...formData, section_banner_url: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                />
                <p className="text-xs text-muted-foreground">Full-width banner image displayed above the section (21:9 aspect ratio recommended)</p>
              </div>
              {formData.section_type === "free_content" && (
                <>
                  <div className="space-y-2">
                    <Label>Content Type Filter</Label>
                    <Select 
                      value={formData.content_type_filter} 
                      onValueChange={(v) => setFormData({ ...formData, content_type_filter: v as "all" | "movie" | "series" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Free Content</SelectItem>
                        <SelectItem value="movie">Free Movies Only</SelectItem>
                        <SelectItem value="series">Free TV Shows Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={formData.is_curated}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_curated: checked })}
                    />
                    <Label>Curated (manually select content)</Label>
                  </div>
                </>
              )}
              {/* Generic filters — available for every section type except dedicated ones */}
              {!["leaving_soon", "by_year"].includes(formData.section_type) && (
                <div className="space-y-3 p-3 bg-secondary/30 rounded-lg">
                  <Label className="text-sm font-medium">Filters (optional)</Label>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Content type</Label>
                    <Select
                      value={formData.content_type_filter}
                      onValueChange={(v) => setFormData({ ...formData, content_type_filter: v as "all" | "movie" | "series" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="movie">Movies only</SelectItem>
                        <SelectItem value="series">Series only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.section_type !== "genre" && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Genre</Label>
                      <Select
                        value={formData.genre_id || "__all__"}
                        onValueChange={(v) => setFormData({ ...formData, genre_id: v === "__all__" ? "" : v })}
                      >
                        <SelectTrigger><SelectValue placeholder="All genres..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All Genres</SelectItem>
                          {genres.filter((genre: any) => genre.id).map((genre: any) => (
                            <SelectItem key={genre.id} value={genre.id}>{genre.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Exact year</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2024"
                      value={formData.year_filter ?? ""}
                      onChange={(e) => setFormData({ ...formData, year_filter: e.target.value ? parseInt(e.target.value) : null })}
                      min={1900}
                      max={2100}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">From year</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 2020"
                        value={formData.year_min ?? ""}
                        onChange={(e) => setFormData({ ...formData, year_min: e.target.value ? parseInt(e.target.value) : null })}
                        min={1900}
                        max={2100}
                        disabled={!!formData.year_filter}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">To year</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 2026"
                        value={formData.year_max ?? ""}
                        onChange={(e) => setFormData({ ...formData, year_max: e.target.value ? parseInt(e.target.value) : null })}
                        min={1900}
                        max={2100}
                        disabled={!!formData.year_filter}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tip: leave all year fields empty for an unfiltered section. Exact year overrides the From/To range.
                  </p>
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
              
              {/* Display Targets */}
              <div className="space-y-3 p-3 bg-secondary/30 rounded-lg">
                <Label className="text-sm font-medium">Display On</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show_desktop"
                      checked={formData.show_on_desktop}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_on_desktop: !!checked })}
                    />
                    <Label htmlFor="show_desktop" className="flex items-center gap-1 text-sm cursor-pointer">
                      <Monitor className="h-4 w-4" /> Desktop
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show_mobile"
                      checked={formData.show_on_mobile}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_on_mobile: !!checked })}
                    />
                    <Label htmlFor="show_mobile" className="flex items-center gap-1 text-sm cursor-pointer">
                      <Smartphone className="h-4 w-4" /> Mobile
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show_kids"
                      checked={formData.show_on_kids}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_on_kids: !!checked })}
                    />
                    <Label htmlFor="show_kids" className="flex items-center gap-1 text-sm cursor-pointer">
                      <Baby className="h-4 w-4" /> Kids
                    </Label>
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

        {/* Manage Curated Content Dialog */}
        <Dialog open={!!managingContentSection} onOpenChange={() => setManagingContentSection(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Manage Content: {managingContentSection?.title}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="current" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="current">Current Content ({sectionContent.length})</TabsTrigger>
                <TabsTrigger value="add">Add Content</TabsTrigger>
              </TabsList>
              <TabsContent value="current" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {sectionContent.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No content added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {sectionContent.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 bg-secondary/30 rounded-lg">
                          <img
                            src={item.content?.thumbnail_url || "/placeholder.svg"}
                            alt={item.content?.title}
                            className="w-12 h-16 object-cover rounded"
                          />
                          <div className="flex-1">
                            <p className="font-medium">{item.content?.title}</p>
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
              </TabsContent>
              <TabsContent value="add" className="mt-4 space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search content..."
                      value={contentSearch}
                      onChange={(e) => setContentSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="movie">Movies</SelectItem>
                      <SelectItem value="series">TV Shows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {filteredContent.map((content) => (
                      <div key={content.id} className="flex items-center gap-3 p-2 bg-secondary/30 rounded-lg">
                        <img
                          src={content.thumbnail_url || "/placeholder.svg"}
                          alt={content.title}
                          className="w-12 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium">{content.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {content.content_type} • {content.year || "N/A"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addContentToSection.mutate({
                            sectionId: managingContentSection!.id,
                            contentId: content.id,
                          })}
                          disabled={addContentToSection.isPending}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {filteredContent.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No content found</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Sections List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : sections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No sections yet. Add your first section above.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
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
