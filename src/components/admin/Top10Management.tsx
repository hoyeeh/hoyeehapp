import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllContent } from "@/lib/fetchAllContent";
import { matchesSearch } from "@/lib/searchMatch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Crown, Trash2, Loader2, Trophy, Search, X, Plus, Film, Tv, Clock, Calendar, GripVertical } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Top10Item {
  id: string;
  content_id: string;
  rank: number;
  content: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    content_type: string;
  };
}

interface ContentItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  content_type: string;
  description: string | null;
  year: number | null;
  genre: string | null;
  duration: number | null;
  is_premium: boolean | null;
}

interface SortableItemProps {
  item: Top10Item;
  onRemove: (id: string, title: string) => void;
}

const SortableItem = ({ item, onRemove }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-3 bg-secondary/30 rounded-lg transition-colors ${
        isDragging ? "opacity-50 shadow-lg ring-2 ring-brand" : "hover:bg-secondary/50"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="w-12 h-12 bg-gradient-to-br from-brand to-brand-dark rounded-lg flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-lg">
        {item.rank}
      </div>
      {item.content?.thumbnail_url ? (
        <img
          src={item.content.thumbnail_url}
          alt={item.content?.title}
          className="w-16 h-20 object-cover rounded"
        />
      ) : (
        <div className="w-16 h-20 bg-muted rounded flex items-center justify-center">
          {item.content?.content_type === "movie" ? (
            <Film className="h-6 w-6 text-muted-foreground" />
          ) : (
            <Tv className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate">{item.content?.title}</h4>
        <p className="text-sm text-muted-foreground capitalize">
          {item.content?.content_type}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(item.id, item.content?.title || "")}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
};

export const Top10Management = () => {
  const queryClient = useQueryClient();
  const [selectedRank, setSelectedRank] = useState<number>(1);
  const [selectedContent, setSelectedContent] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [hoveredContent, setHoveredContent] = useState<string | null>(null);
  const [itemToRemove, setItemToRemove] = useState<{ id: string; title: string } | null>(null);
  const [lastRemovedItem, setLastRemovedItem] = useState<{ contentId: string; rank: number; title: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: top10 = [], isLoading } = useQuery({
    queryKey: ["top-10"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("top_10")
        .select(`
          id,
          content_id,
          rank,
          content:content_id (
            id,
            title,
            thumbnail_url,
            content_type
          )
        `)
        .order("rank");
      if (error) throw error;
      return data as unknown as Top10Item[];
    },
  });

  const { data: allContent = [] } = useQuery({
    queryKey: ["all-content-extended"],
    queryFn: async () => {
      return await fetchAllContent<ContentItem>(
        "id, title, thumbnail_url, content_type, description, year, genre, duration, is_premium",
        (q) => q.order("title")
      );
    },
  });

  // Filter out content already in top 10
  const availableContent = allContent.filter(
    (c) => !top10.some((t) => t.content_id === c.id)
  );

  // Apply search and content type filters
  const filteredContent = useMemo(() => {
    return availableContent.filter((c) => {
      const matchesType = contentTypeFilter === "all" ||
        c.content_type === contentTypeFilter;
      if (!matchesType) return false;
      return matchesSearch(searchQuery, c.title, c.description, c.genre);
    });
  }, [availableContent, searchQuery, contentTypeFilter]);

  // Get available ranks (1-10 not yet used)
  const usedRanks = top10.map((t) => t.rank);
  const availableRanks = Array.from({ length: 10 }, (_, i) => i + 1).filter(
    (r) => !usedRanks.includes(r)
  );

  const addToTop10 = useMutation({
    mutationFn: async ({ contentId, rank }: { contentId: string; rank: number }) => {
      const { error } = await supabase
        .from("top_10")
        .insert({ content_id: contentId, rank });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["top-10"] });
      setSelectedContent("");
      toast.success("Added to Top 10");
    },
    onError: (error: any) => {
      console.error("Error adding to top 10:", error);
      toast.error("Failed to add to Top 10");
    },
  });

  const removeFromTop10 = useMutation({
    mutationFn: async ({ id, contentId, rank, title }: { id: string; contentId: string; rank: number; title: string }) => {
      const { error } = await supabase.from("top_10").delete().eq("id", id);
      if (error) throw error;
      return { contentId, rank, title };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["top-10"] });
      setItemToRemove(null);
      setLastRemovedItem(data);
      
      toast.success(`Removed "${data.title}" from Top 10`, {
        action: {
          label: "Undo",
          onClick: () => handleUndo(data.contentId, data.rank),
        },
        duration: 8000,
      });
    },
    onError: () => toast.error("Failed to remove from Top 10"),
  });

  const undoRemove = useMutation({
    mutationFn: async ({ contentId, rank }: { contentId: string; rank: number }) => {
      const { error } = await supabase
        .from("top_10")
        .insert({ content_id: contentId, rank });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["top-10"] });
      setLastRemovedItem(null);
      toast.success("Item restored to Top 10");
    },
    onError: () => toast.error("Failed to restore item"),
  });

  const handleUndo = (contentId: string, rank: number) => {
    undoRemove.mutate({ contentId, rank });
  };

  const reorderTop10 = useMutation({
    mutationFn: async (updates: { id: string; rank: number }[]) => {
      // Update all ranks in parallel
      const promises = updates.map(({ id, rank }) =>
        supabase.from("top_10").update({ rank }).eq("id", id)
      );
      const results = await Promise.all(promises);
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["top-10"] });
      toast.success("Ranks updated");
    },
    onError: () => toast.error("Failed to reorder"),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = top10.findIndex((item) => item.id === active.id);
      const newIndex = top10.findIndex((item) => item.id === over.id);

      const reorderedItems = arrayMove(top10, oldIndex, newIndex);
      
      // Create updates with new ranks based on position
      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        rank: index + 1,
      }));

      reorderTop10.mutate(updates);
    }
  };

  const handleQuickAdd = (contentId: string, rank: number) => {
    addToTop10.mutate({ contentId, rank });
  };

  const handleRemoveClick = (id: string, title: string) => {
    setItemToRemove({ id, title });
  };

  const confirmRemove = () => {
    if (itemToRemove) {
      const item = top10.find(t => t.id === itemToRemove.id);
      if (item) {
        removeFromTop10.mutate({
          id: itemToRemove.id,
          contentId: item.content_id,
          rank: item.rank,
          title: itemToRemove.title,
        });
      }
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const selectedContentData = selectedContent 
    ? filteredContent.find(c => c.id === selectedContent) 
    : null;

  return (
    <>
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-brand" />
            Top 10 Management
          </CardTitle>
          <CardDescription>
            Select and rank the top 10 movies/shows to feature prominently like Netflix
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add to Top 10 */}
          {availableRanks.length > 0 && availableContent.length > 0 && (
            <div className="space-y-4 p-4 bg-secondary/30 rounded-lg">
              {/* Search and Filter Row */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search movies & TV shows..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="movie">Movies</SelectItem>
                    <SelectItem value="series">TV Shows</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Content Preview */}
              {selectedContentData && (
                <div className="flex items-center gap-3 p-3 bg-brand/10 border border-brand/30 rounded-lg">
                  <div className="w-12 h-16 bg-secondary rounded overflow-hidden flex-shrink-0">
                    {selectedContentData.thumbnail_url ? (
                      <img
                        src={selectedContentData.thumbnail_url}
                        alt={selectedContentData.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        {selectedContentData.content_type === "movie" ? (
                          <Film className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Tv className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedContentData.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {selectedContentData.content_type}
                      </Badge>
                      {selectedContentData.year && <span>{selectedContentData.year}</span>}
                    </div>
                  </div>
                  <Select value={selectedRank.toString()} onValueChange={(v) => setSelectedRank(Number(v))}>
                    <SelectTrigger className="w-20">
                      <SelectValue placeholder="Rank" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRanks.map((rank) => (
                        <SelectItem key={rank} value={rank.toString()}>
                          #{rank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => addToTop10.mutate({ contentId: selectedContent, rank: selectedRank })} 
                    disabled={addToTop10.isPending}
                    size="sm"
                  >
                    {addToTop10.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setSelectedContent("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Content Preview Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Available Content ({filteredContent.length})
                  </p>
                  {!selectedContentData && (
                    <p className="text-xs text-muted-foreground">
                      Click to select or use + for quick add
                    </p>
                  )}
                </div>
                
                {filteredContent.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No content matches your search</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[320px] rounded-lg border bg-background/50">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3">
                      {filteredContent.map((content) => (
                        <div
                          key={content.id}
                          className={`group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
                            selectedContent === content.id
                              ? "ring-2 ring-brand ring-offset-2 ring-offset-background"
                              : "hover:ring-2 hover:ring-muted-foreground/50"
                          }`}
                          onClick={() => setSelectedContent(content.id)}
                          onMouseEnter={() => setHoveredContent(content.id)}
                          onMouseLeave={() => setHoveredContent(null)}
                        >
                          {/* Thumbnail */}
                          <div className="aspect-[2/3] bg-secondary relative">
                            {content.thumbnail_url ? (
                              <img
                                src={content.thumbnail_url}
                                alt={content.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted">
                                {content.content_type === "movie" ? (
                                  <Film className="h-8 w-8 text-muted-foreground" />
                                ) : (
                                  <Tv className="h-8 w-8 text-muted-foreground" />
                                )}
                              </div>
                            )}
                            
                            {/* Premium Badge */}
                            {content.is_premium && (
                              <Badge className="absolute top-1 right-1 bg-amber-500/90 text-[10px] px-1.5 py-0">
                                <Crown className="h-2.5 w-2.5 mr-0.5" />
                                Premium
                              </Badge>
                            )}

                            {/* Content Type Badge */}
                            <Badge 
                              variant="secondary" 
                              className="absolute top-1 left-1 text-[10px] px-1.5 py-0 bg-black/60 text-white border-0"
                            >
                              {content.content_type === "movie" ? (
                                <Film className="h-2.5 w-2.5 mr-0.5" />
                              ) : (
                                <Tv className="h-2.5 w-2.5 mr-0.5" />
                              )}
                              {content.content_type}
                            </Badge>

                            {/* Quick Add Button */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="absolute bottom-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-brand hover:bg-brand/90 text-white shadow-lg"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-32 p-2" align="end">
                                <p className="text-xs font-medium mb-2 text-muted-foreground">Select Rank</p>
                                <div className="grid grid-cols-2 gap-1">
                                  {availableRanks.map((rank) => (
                                    <Button
                                      key={rank}
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs"
                                      onClick={() => handleQuickAdd(content.id, rank)}
                                      disabled={addToTop10.isPending}
                                    >
                                      #{rank}
                                    </Button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>

                            {/* Selected Indicator */}
                            {selectedContent === content.id && (
                              <div className="absolute inset-0 bg-brand/20 flex items-center justify-center">
                                <div className="bg-brand text-white rounded-full p-1">
                                  <Trophy className="h-4 w-4" />
                                </div>
                              </div>
                            )}

                            {/* Hover Description Overlay */}
                            {hoveredContent === content.id && content.description && (
                              <div className="absolute inset-0 bg-black/80 p-2 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[10px] text-white/90 line-clamp-4">
                                  {content.description}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Content Info */}
                          <div className="p-2 bg-card">
                            <p className="text-xs font-medium truncate" title={content.title}>
                              {content.title}
                            </p>
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                              {content.year && (
                                <span className="flex items-center gap-0.5">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {content.year}
                                </span>
                              )}
                              {content.duration && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatDuration(content.duration)}
                                </span>
                              )}
                            </div>
                            {content.genre && (
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {content.genre}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}

          {availableRanks.length === 0 && (
            <div className="p-4 bg-brand/10 border border-brand/30 rounded-lg text-center">
              <Trophy className="h-8 w-8 mx-auto mb-2 text-brand" />
              <p className="font-medium">Top 10 is Full!</p>
              <p className="text-sm text-muted-foreground">Remove items below to add new ones</p>
            </div>
          )}

          {/* Current Top 10 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Crown className="h-4 w-4" />
                Current Top 10 ({top10.length}/10)
              </h3>
              {top10.length > 1 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <GripVertical className="h-3 w-3" />
                  Drag to reorder
                </p>
              )}
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
              </div>
            ) : top10.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                <Crown className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No content in Top 10 yet</p>
                <p className="text-sm">Search and add content from above</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={top10.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="grid gap-3">
                    {top10.map((item) => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        onRemove={handleRemoveClick}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!itemToRemove} onOpenChange={(open) => !open && setItemToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Top 10?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{itemToRemove?.title}" from the Top 10 list? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeFromTop10.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
