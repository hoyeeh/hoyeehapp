import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Plus, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { QueueItem } from '@/hooks/useCastController';
import { cn } from '@/lib/utils';

interface CastContentPickerProps {
  onSelectVideo: (video: {
    url: string;
    title: string;
    thumbnail?: string;
    duration?: number;
  }) => void;
  onAddToQueue: (item: QueueItem) => void;
}

export function CastContentPicker({ onSelectVideo, onAddToQueue }: CastContentPickerProps) {
  const [search, setSearch] = useState('');

  const { data: content, isLoading } = useQuery({
    queryKey: ['cast-content', search],
    queryFn: async () => {
      let query = supabase
        .from('content')
        .select('id, title, thumbnail_url, video_url, duration')
        .not('video_url', 'is', null)
        .order('view_count', { ascending: false })
        .limit(20);

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handlePlay = (item: typeof content[0]) => {
    if (!item.video_url) return;
    onSelectVideo({
      url: item.video_url,
      title: item.title,
      thumbnail: item.thumbnail_url || undefined,
      duration: item.duration || undefined,
    });
  };

  const handleAddToQueue = (item: typeof content[0]) => {
    if (!item.video_url) return;
    onAddToQueue({
      id: item.id,
      url: item.video_url,
      title: item.title,
      thumbnail: item.thumbnail_url || undefined,
      duration: item.duration || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search videos..."
          className="pl-10"
        />
      </div>

      {/* Content List */}
      <ScrollArea className="h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : content?.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No videos found
          </div>
        ) : (
          <div className="space-y-2">
            {content?.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-lg',
                  'hover:bg-muted/50 transition-colors',
                  'group'
                )}
              >
                {/* Thumbnail */}
                <div className="relative w-24 aspect-video rounded-md overflow-hidden bg-muted flex-shrink-0">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Play className="h-6 w-6" />
                    </div>
                  )}
                  {item.duration && (
                    <span className="absolute bottom-1 right-1 text-[10px] bg-black/80 text-white px-1 rounded">
                      {formatDuration(item.duration)}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    onClick={() => handlePlay(item)}
                    disabled={!item.video_url}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Cast
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleAddToQueue(item)}
                    disabled={!item.video_url}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
