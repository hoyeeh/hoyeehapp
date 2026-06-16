import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, ChevronRight, Bell, BellOff, Calendar, Play } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

interface ComingSoonRowProps {
  onWatchTrailer?: (trailerUrl: string, title: string) => void;
  maxItems?: number;
}

export const ComingSoonRow = ({ onWatchTrailer, maxItems = 15 }: ComingSoonRowProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch coming soon content
  const { data: comingSoon = [] } = useQuery({
    queryKey: ["coming-soon"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coming_soon")
        .select("*")
        .eq("is_active", true)
        .order("expected_release_date", { ascending: true });
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

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const toggleWatchlist = (comingSoonId: string) => {
    if (!user) {
      toast.error("Please sign in to get notifications");
      return;
    }
    if (userWatchlist.includes(comingSoonId)) {
      removeFromWatchlist.mutate(comingSoonId);
    } else {
      addToWatchlist.mutate(comingSoonId);
    }
  };

  if (comingSoon.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="font-display text-xl md:text-2xl mb-4 px-4 md:px-12 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-brand" />
        Coming Soon
      </h2>

      <div className="relative group/row">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-8 z-10 w-12 bg-gradient-to-r from-background to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>

        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-8 z-10 w-12 bg-gradient-to-l from-background to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-8 w-8" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {comingSoon.map((item: any) => {
            const isInWatchlist = userWatchlist.includes(item.id);
            
            return (
              <div
                key={item.id}
                className="group relative flex-shrink-0 w-36 md:w-44"
              >
                {/* Poster format (portrait) */}
                <div className="relative rounded-lg overflow-hidden bg-secondary aspect-[2/3]">
                  <img
                    src={item.thumbnail_url || "/placeholder.svg"}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Coming Soon Badge */}
                  <div className="absolute top-2 left-2 bg-gradient-to-r from-brand to-brand-dark px-2 py-0.5 rounded text-[10px] font-semibold text-primary-foreground">
                    COMING SOON
                  </div>

                  {/* Release Date */}
                  {item.expected_release_date && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
                      <p className="text-xs text-white/90 font-medium">
                        {format(new Date(item.expected_release_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  )}

                  {/* Hover Overlay with Actions */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
                    {item.trailer_url && onWatchTrailer && (
                      <Button
                        size="sm"
                        className="w-full gap-1 text-xs"
                        onClick={() => onWatchTrailer(item.trailer_url, item.title)}
                      >
                        <Play className="h-3 w-3" fill="currentColor" />
                        Trailer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={isInWatchlist ? "secondary" : "outline"}
                      onClick={() => toggleWatchlist(item.id)}
                      className="w-full gap-1 text-xs"
                    >
                      {isInWatchlist ? (
                        <>
                          <BellOff className="h-3 w-3" />
                          Notified
                        </>
                      ) : (
                        <>
                          <Bell className="h-3 w-3" />
                          Notify Me
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Title & Info */}
                <div className="mt-2">
                  <h3 className="font-medium text-xs truncate">{item.title}</h3>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                    <span className="capitalize">{item.content_type}</span>
                    {item.genre && (
                      <>
                        <span>•</span>
                        <span className="truncate">{item.genre}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
