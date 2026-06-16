import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, BellOff, Play, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useMobileYouTubePlayer } from "@/contexts/MobileYouTubePlayerContext";

const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

interface MobileComingSoonRowProps {
  onWatchTrailer?: (trailerUrl: string, title: string) => void;
  maxItems?: number;
}

export function MobileComingSoonRow({ onWatchTrailer, maxItems = 10 }: MobileComingSoonRowProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openPlayer } = useMobileYouTubePlayer();

  // Fetch coming soon content
  const { data: comingSoon = [], isLoading } = useQuery({
    queryKey: ["coming-soon", maxItems],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coming_soon")
        .select("*")
        .eq("is_active", true)
        .order("expected_release_date", { ascending: true })
        .limit(maxItems);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user's coming soon watchlist
  const { data: userWatchlist = [] } = useQuery({
    queryKey: ["coming-soon-watchlist", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("coming_soon_watchlist")
        .select("coming_soon_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((item: any) => item.coming_soon_id);
    },
    enabled: !!user,
  });

  // Add to watchlist mutation
  const addToWatchlist = useMutation({
    mutationFn: async (comingSoonId: string) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase.from("coming_soon_watchlist").insert({
        user_id: user.id,
        coming_soon_id: comingSoonId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coming-soon-watchlist"] });
      toast.success("You'll be notified when this is available!");
    },
    onError: () => {
      toast.error("Failed to add to watchlist");
    },
  });

  // Remove from watchlist mutation
  const removeFromWatchlist = useMutation({
    mutationFn: async (comingSoonId: string) => {
      if (!user) throw new Error("Must be logged in");
      const { error } = await supabase
        .from("coming_soon_watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("coming_soon_id", comingSoonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coming-soon-watchlist"] });
      toast.success("Removed from notifications");
    },
    onError: () => {
      toast.error("Failed to remove from watchlist");
    },
  });

  const toggleWatchlist = (e: React.MouseEvent, comingSoonId: string) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Please sign in to get notifications");
      navigate("/auth");
      return;
    }
    if (userWatchlist.includes(comingSoonId)) {
      removeFromWatchlist.mutate(comingSoonId);
    } else {
      addToWatchlist.mutate(comingSoonId);
    }
  };

  const handlePlayTrailer = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    if (!item.trailer_url) return;

    const videoId = extractYouTubeVideoId(item.trailer_url);
    if (videoId) {
      openPlayer({
        videoId,
        title: `${item.title} - Trailer`,
        thumbnail: item.thumbnail_url,
      });
    } else if (onWatchTrailer) {
      onWatchTrailer(item.trailer_url, item.title);
    } else {
      window.open(item.trailer_url, "_blank");
    }
  };

  if (isLoading) {
    return (
      <section className="py-4">
        <div className="flex items-center gap-2 px-4 mb-3">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Coming Soon</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 scrollbar-hide">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-32">
              <Skeleton className="w-full aspect-[2/3] rounded-lg" />
              <Skeleton className="w-3/4 h-3 mt-2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (comingSoon.length === 0) return null;

  return (
    <section className="py-4">
      {/* Header with See All */}
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Coming Soon</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary text-xs"
          onClick={() => navigate("/coming-soon")}
        >
          See All
        </Button>
      </div>

      {/* Horizontal scroll list */}
      <div
        className="flex gap-3 overflow-x-auto px-4 scrollbar-hide pb-2"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {comingSoon.map((item: any) => {
          const isInWatchlist = userWatchlist.includes(item.id);

          return (
            <div
              key={item.id}
              className="flex-shrink-0 w-32 group"
              onClick={() => navigate("/coming-soon")}
            >
              {/* Poster */}
              <div className="relative rounded-lg overflow-hidden bg-muted aspect-[2/3]">
                <img
                  src={item.thumbnail_url || "/placeholder.svg"}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                {/* Coming Soon Badge */}
                <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-primary to-primary/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-primary-foreground">
                  SOON
                </div>

                {/* Release Date */}
                {item.expected_release_date && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
                    <p className="text-[10px] text-white/90 font-medium">
                      {format(new Date(item.expected_release_date), "MMM d")}
                    </p>
                  </div>
                )}

                {/* Quick Actions - Always visible on mobile */}
                <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                  {item.trailer_url && (
                    <button
                      onClick={(e) => handlePlayTrailer(e, item)}
                      className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <Play className="h-3.5 w-3.5 text-white" fill="white" />
                    </button>
                  )}
                  <button
                    onClick={(e) => toggleWatchlist(e, item.id)}
                    className={`w-7 h-7 rounded-full backdrop-blur-sm flex items-center justify-center active:scale-95 transition-all ${
                      isInWatchlist
                        ? "bg-primary text-primary-foreground"
                        : "bg-black/60 text-white"
                    }`}
                  >
                    {isInWatchlist ? (
                      <BellOff className="h-3.5 w-3.5" />
                    ) : (
                      <Bell className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Title & Info */}
              <div className="mt-1.5">
                <h3 className="font-medium text-xs truncate">{item.title}</h3>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {item.content_type}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
