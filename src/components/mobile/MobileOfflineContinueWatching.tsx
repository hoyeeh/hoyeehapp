import { useState, useEffect, useMemo } from "react";
import { Play, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { getAllPlaybackPositions } from "@/lib/playbackStorage";
import { cn } from "@/lib/utils";

interface MobileOfflineContinueWatchingProps {
  onPlay: (content: Content, progress?: number, episodeId?: string) => void;
  onDetails: (content: Content) => void;
}

interface ContinueWatchingItem {
  id: string;
  contentId: string;
  episodeId?: string;
  title: string;
  thumbnailUrl: string;
  progress: number;
  duration: number;
  episodeInfo?: string;
  isOffline: boolean;
}

export function MobileOfflineContinueWatching({
  onPlay,
  onDetails,
}: MobileOfflineContinueWatchingProps) {
  const { user } = useAuth();
  const { currentProfile } = useProfileContext();
  const [localItems, setLocalItems] = useState<ContinueWatchingItem[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);

  // Load local IndexedDB playback positions immediately (offline-first)
  useEffect(() => {
    const loadLocalProgress = async () => {
      try {
        const positions = await getAllPlaybackPositions();
        const items: ContinueWatchingItem[] = positions
          .filter((p) => {
            const progressPercent = (p.position / p.duration) * 100;
            return progressPercent > 1 && progressPercent < 95;
          })
          .map((p) => ({
            id: p.id,
            contentId: p.contentId,
            episodeId: p.episodeId,
            title: p.title || "Unknown",
            thumbnailUrl: p.thumbnail || "",
            progress: p.position,
            duration: p.duration,
            isOffline: true,
          }));
        setLocalItems(items);
      } catch (error) {
        console.error("[OfflineContinueWatching] Failed to load local progress:", error);
      } finally {
        setIsLoadingLocal(false);
      }
    };

    loadLocalProgress();
  }, []);

  // Fetch server data when online - filtered by profile
  const { data: serverItems = [] } = useQuery({
    queryKey: ["mobile-continue-watching", user?.id, currentProfile?.id],
    queryFn: async () => {
      if (!user) return [];

      // Build query for watch history
      let query = supabase
        .from("watch_history")
        .select("content_id, progress, last_watched, profile_id")
        .eq("user_id", user.id)
        .order("last_watched", { ascending: false })
        .limit(20);
      
      // Filter by profile if one is selected
      if (currentProfile?.id) {
        query = query.eq("profile_id", currentProfile.id);
      }
      
      const { data: watchHistory, error } = await query;

      if (error) throw error;
      if (!watchHistory?.length) return [];

      // Fetch content details
      const contentIds = [...new Set(watchHistory.map((h) => h.content_id))];
      const { data: contents } = await supabase
        .from("content")
        .select("id, title, thumbnail_url, duration, content_type")
        .in("id", contentIds);

      if (!contents?.length) return [];

      const contentMap = new Map(contents.map((c) => [c.id, c]));

      return watchHistory
        .filter((h) => {
          const content = contentMap.get(h.content_id);
          if (!content) return false;
          const progressPercent = (h.progress / (content.duration || 1)) * 100;
          return progressPercent > 1 && progressPercent < 95;
        })
        .map((h) => {
          const content = contentMap.get(h.content_id)!;
          return {
            id: h.content_id,
            contentId: h.content_id,
            title: content.title,
            thumbnailUrl: content.thumbnail_url || "",
            progress: h.progress,
            duration: content.duration || 0,
            isOffline: false,
          } as ContinueWatchingItem;
        });
    },
    enabled: !!user,
    staleTime: 30000,
  });

  // Merge local and server data, prioritizing local (more recent)
  const mergedItems = useMemo(() => {
    const itemMap = new Map<string, ContinueWatchingItem>();

    // Add server items first
    serverItems.forEach((item) => {
      itemMap.set(item.id, item);
    });

    // Override with local items (more recent progress)
    localItems.forEach((item) => {
      const existing = itemMap.get(item.id);
      // Only use local if it has thumbnail (proper data) or doesn't exist on server
      if (!existing || item.thumbnailUrl) {
        itemMap.set(item.id, { ...existing, ...item });
      } else if (existing) {
        // Update progress from local but keep server metadata
        itemMap.set(item.id, { ...existing, progress: item.progress, isOffline: true });
      }
    });

    return Array.from(itemMap.values()).slice(0, 10);
  }, [localItems, serverItems]);

  const formatTimeRemaining = (current: number, total: number) => {
    const remaining = Math.max(0, total - current);
    if (remaining < 60) return `${Math.round(remaining)}s left`;
    if (remaining < 3600) return `${Math.round(remaining / 60)}m left`;
    return `${Math.floor(remaining / 3600)}h ${Math.round((remaining % 3600) / 60)}m left`;
  };

  if (isLoadingLocal && !serverItems.length) {
    return null;
  }

  if (mergedItems.length === 0) {
    return null;
  }

  return (
    <section className="py-4">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold">Continue Watching</h2>
        <button className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>See all</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-2">
        {mergedItems.map((item) => {
          const progressPercent = (item.progress / item.duration) * 100;

          return (
            <div
              key={item.id}
              className="flex-shrink-0 w-36"
              onClick={() => {
                // Create a minimal Content object for playback
                const content: Content = {
                  id: item.contentId,
                  title: item.title,
                  description: "",
                  thumbnailUrl: item.thumbnailUrl,
                  videoUrl: "",
                  genre: "",
                  contentType: "movie",
                  isPremium: false,
                  duration: item.duration,
                };
                onDetails(content);
              }}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-secondary mb-2">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
                )}

                {/* Play button overlay */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const content: Content = {
                      id: item.contentId,
                      title: item.title,
                      description: "",
                      thumbnailUrl: item.thumbnailUrl,
                      videoUrl: "",
                      genre: "",
                      contentType: "movie",
                      isPremium: false,
                      duration: item.duration,
                    };
                    onPlay(content, item.progress, item.episodeId);
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-background/20 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity"
                >
                  <div className="w-10 h-10 rounded-full bg-foreground/90 flex items-center justify-center shadow-lg">
                    <Play className="h-4 w-4 text-background ml-0.5" fill="currentColor" />
                  </div>
                </button>

                {/* Offline indicator */}
                {item.isOffline && (
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-primary/80 rounded text-[10px] font-medium text-primary-foreground">
                    Offline
                  </div>
                )}

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Title and info */}
              <h3 className="text-xs font-medium line-clamp-1 mb-0.5">{item.title}</h3>
              <p className="text-[10px] text-muted-foreground">
                {item.episodeInfo || formatTimeRemaining(item.progress, item.duration)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
