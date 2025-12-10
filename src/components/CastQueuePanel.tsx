import { ListVideo, Trash2, X, ChevronUp, ChevronDown, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { QueueItem } from '@/hooks/useCastQueue';

interface CastQueuePanelProps {
  queue: QueueItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onPlayAtIndex: (index: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function CastQueuePanel({
  queue,
  currentIndex,
  isOpen,
  onClose,
  onPlayAtIndex,
  onRemove,
  onClear,
  onReorder,
}: CastQueuePanelProps) {
  if (!isOpen) return null;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-card/95 backdrop-blur-lg border-l border-border z-50 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ListVideo className="h-5 w-5 text-brand" />
          <h3 className="font-semibold">Cast Queue</h3>
          <span className="text-xs text-muted-foreground">({queue.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear} className="text-destructive hover:text-destructive">
              Clear All
            </Button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100%-64px)]">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ListVideo className="h-12 w-12 mb-4 opacity-50" />
            <p>Queue is empty</p>
            <p className="text-sm">Add videos to play continuously</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {queue.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors group",
                  index === currentIndex 
                    ? "bg-brand/20 border border-brand/30" 
                    : "hover:bg-muted/50"
                )}
              >
                {/* Thumbnail */}
                <div 
                  className="relative w-16 h-9 rounded overflow-hidden bg-muted flex-shrink-0 cursor-pointer"
                  onClick={() => onPlayAtIndex(index)}
                >
                  {item.thumbnail ? (
                    <img 
                      src={item.thumbnail} 
                      alt={item.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  {index === currentIndex && (
                    <div className="absolute inset-0 bg-brand/30 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    index === currentIndex && "text-brand"
                  )}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(item.duration)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onReorder(index, Math.max(0, index - 1))}
                    disabled={index === 0}
                    className="p-1 hover:bg-muted rounded disabled:opacity-30"
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onReorder(index, Math.min(queue.length - 1, index + 1))}
                    disabled={index === queue.length - 1}
                    className="p-1 hover:bg-muted rounded disabled:opacity-30"
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="p-1 hover:bg-destructive/20 text-destructive rounded"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
