import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Edit2, Trash2, GripVertical, Clock, SkipForward } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { TranscodingStatus } from "./TranscodingStatus";

interface Episode {
  id: string;
  episode_number: number;
  title: string;
  duration: number;
  is_premium: boolean;
  video_url: string | null;
  description: string | null;
  thumbnail_url: string | null;
  intro_start_time?: number | null;
  intro_end_time?: number | null;
  recap_start_time?: number | null;
  recap_end_time?: number | null;
}

interface SortableEpisodeListProps {
  episodes: Episode[];
  onEdit: (episode: Episode) => void;
  onDelete: (episodeId: string) => void;
  onReorder: (episodes: { id: string; episode_number: number }[]) => void;
}

interface SortableEpisodeProps {
  episode: Episode;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
}

const SortableEpisode = ({ episode, onEdit, onDelete, onPreview }: SortableEpisodeProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: episode.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        
        {/* Video preview thumbnail/button */}
        <button
          onClick={episode.video_url ? onPreview : undefined}
          disabled={!episode.video_url}
          className={`w-16 h-10 rounded flex items-center justify-center relative overflow-hidden shrink-0 ${
            episode.video_url 
              ? 'bg-primary/20 hover:bg-primary/30 cursor-pointer' 
              : 'bg-muted cursor-not-allowed'
          }`}
        >
          {episode.thumbnail_url ? (
            <img 
              src={episode.thumbnail_url} 
              alt={episode.title}
              className="w-full h-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Play className={`h-4 w-4 ${episode.video_url ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            E{episode.episode_number}: {episode.title}
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            <span>{episode.duration} min</span>
            {episode.is_premium && (
              <span className="text-primary">Premium</span>
            )}
            {episode.video_url ? (
              <span className="text-green-500">✓ Video</span>
            ) : (
              <span className="text-yellow-500">No Video</span>
            )}
            {/* Intro times indicator */}
            {(episode.intro_end_time && episode.intro_end_time !== 90) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-blue-400 flex items-center gap-0.5 cursor-help">
                    <SkipForward className="h-3 w-3" />
                    {episode.intro_start_time || 0}s-{episode.intro_end_time}s
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Custom intro skip: {episode.intro_start_time || 0}s to {episode.intro_end_time}s</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Recap indicator */}
            {(episode.recap_start_time !== null && episode.recap_start_time !== undefined) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-purple-400 flex items-center gap-0.5 cursor-help">
                    <Clock className="h-3 w-3" />
                    Recap
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Previously On recap: {episode.recap_start_time}s to {episode.recap_end_time}s</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        {/* Transcoding Status */}
        <TranscodingStatus 
          episodeId={episode.id} 
          videoUrl={episode.video_url} 
        />
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

export const SortableEpisodeList = ({ 
  episodes, 
  onEdit, 
  onDelete, 
  onReorder 
}: SortableEpisodeListProps) => {
  const [previewEpisode, setPreviewEpisode] = useState<Episode | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = episodes.findIndex((ep) => ep.id === active.id);
      const newIndex = episodes.findIndex((ep) => ep.id === over.id);

      const reordered = arrayMove(episodes, oldIndex, newIndex);
      
      // Create new episode numbers based on position
      const updates = reordered.map((ep, index) => ({
        id: ep.id,
        episode_number: index + 1,
      }));

      onReorder(updates);
    }
  }, [episodes, onReorder]);

  // Sort episodes by episode_number for display
  const sortedEpisodes = [...episodes].sort((a, b) => a.episode_number - b.episode_number);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortedEpisodes.map(ep => ep.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sortedEpisodes.map((episode) => (
              <SortableEpisode
                key={episode.id}
                episode={episode}
                onEdit={() => onEdit(episode)}
                onDelete={() => onDelete(episode.id)}
                onPreview={() => setPreviewEpisode(episode)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Video Preview Dialog */}
      <Dialog open={!!previewEpisode} onOpenChange={() => setPreviewEpisode(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                E{previewEpisode?.episode_number}: {previewEpisode?.title}
              </span>
            </DialogTitle>
          </DialogHeader>
          {previewEpisode?.video_url && (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={previewEpisode.video_url}
                controls
                autoPlay
                className="w-full h-full"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
          {previewEpisode?.description && (
            <p className="text-sm text-muted-foreground mt-2">
              {previewEpisode.description}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
