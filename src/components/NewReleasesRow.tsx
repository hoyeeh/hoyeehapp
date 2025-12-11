import { Content } from "@/types";
import { ContentCardWithPreview } from "./ContentCardWithPreview";
import { ChevronLeft, ChevronRight, Film, Tv2 } from "lucide-react";
import { useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";
import { Button } from "@/components/ui/button";

interface NewReleasesRowProps {
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  userList?: string[];
  title?: string;
  maxItems?: number;
  contentTypeFilter?: "all" | "movie" | "series";
  showFilterControls?: boolean;
}

export const NewReleasesRow = ({
  onPlay,
  onToggleList,
  onDetails,
  userList = [],
  title = "New Releases",
  maxItems = 20,
  contentTypeFilter: initialFilter = "all",
  showFilterControls = true,
}: NewReleasesRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "movie" | "series">(initialFilter);

  // Fetch content from last 2 weeks
  const { data: newReleases = [] } = useQuery({
    queryKey: ["new-releases-2-weeks", activeFilter, maxItems],
    queryFn: async () => {
      const twoWeeksAgo = subDays(new Date(), 14).toISOString();
      let query = supabase
        .from("content")
        .select("*")
        .gte("created_at", twoWeeksAgo)
        .order("created_at", { ascending: false })
        .limit(maxItems);
      
      // Apply content type filter if not "all"
      if (activeFilter !== "all") {
        query = query.eq("content_type", activeFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Transform to Content type
  const content: Content[] = useMemo(() => {
    return newReleases.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description || "",
      thumbnailUrl: item.thumbnail_url || "",
      videoUrl: item.video_url || "",
      genre: item.genre || "",
      contentType: item.content_type as "movie" | "series",
      isPremium: item.is_premium || false,
      duration: item.duration || 0,
      year: item.year,
      contentRating: item.content_rating,
      createdAt: item.created_at,
    }));
  }, [newReleases]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  if (content.length === 0) return null;

  return (
    <section className="group/section relative py-4 transition-all duration-300 hover:z-10">
      {/* Section Title with Filter Controls */}
      <div className="px-4 md:px-12 mb-3 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-lg md:text-xl lg:text-2xl text-foreground tracking-wide">
            {title}
          </h2>
          <span className="text-brand text-sm font-medium opacity-0 group-hover/section:opacity-100 transition-opacity cursor-pointer hover:underline">
            Explore All →
          </span>
        </div>
        
        {showFilterControls && (
          <div className="flex items-center gap-2">
            <Button
              variant={activeFilter === "all" ? "brand" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("all")}
              className="text-xs h-7 px-3"
            >
              All
            </Button>
            <Button
              variant={activeFilter === "movie" ? "brand" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("movie")}
              className="text-xs h-7 px-3 gap-1"
            >
              <Film className="h-3 w-3" />
              Movies
            </Button>
            <Button
              variant={activeFilter === "series" ? "brand" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("series")}
              className="text-xs h-7 px-3 gap-1"
            >
              <Tv2 className="h-3 w-3" />
              TV Shows
            </Button>
          </div>
        )}
      </div>
      
      <div className="relative">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll("left")}
          className={cn(
            "absolute left-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center",
            "bg-gradient-to-r from-background via-background/90 to-transparent",
            "transition-all duration-300",
            showLeftArrow ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="w-10 h-10 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-secondary hover:scale-110 transition-all">
            <ChevronLeft className="h-6 w-6" />
          </div>
        </button>
        
        {/* Right Scroll Button */}
        <button
          onClick={() => scroll("right")}
          className={cn(
            "absolute right-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center",
            "bg-gradient-to-l from-background via-background/90 to-transparent",
            "transition-all duration-300",
            showRightArrow ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="w-10 h-10 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-secondary hover:scale-110 transition-all">
            <ChevronRight className="h-6 w-6" />
          </div>
        </button>

        {/* Content Scroll Container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-2 scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {content.map((item, index) => (
            <div key={item.id} className="flex-shrink-0">
              <ContentCardWithPreview
                content={item}
                onPlay={onPlay}
                onToggleList={onToggleList}
                onDetails={onDetails}
                isInList={userList.includes(item.id)}
                cardStyle={index === 0 ? "backdrop" : "poster"}
                showJustAddedBadge={true}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
