import { Content } from "@/types";
import { ContentCardWithPreview } from "./ContentCardWithPreview";
import { ChevronLeft, ChevronRight, ShoppingBag, CheckCircle } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePaidContentForHome, useUserPurchases } from "@/hooks/usePaidContent";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface PaidContentRowProps {
  title?: string;
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  userList?: string[];
  maxItems?: number;
}

export const PaidContentRow = ({
  title = "Creator Store",
  onPlay,
  onToggleList,
  onDetails,
  userList = [],
  maxItems = 15,
}: PaidContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const { user } = useAuth();

  const { data: paidContent = [], isLoading } = usePaidContentForHome();
  const { data: purchases = [] } = useUserPurchases();

  // Create a set of purchased content IDs for quick lookup
  const purchasedContentIds = new Set(purchases.map((p) => p.content_id));

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

  // Transform paid content to Content type with additional info
  const contentItems = paidContent.slice(0, maxItems).map((item: any) => ({
    id: item.content?.id || item.content_id,
    title: item.content?.title || "",
    description: item.content?.description || "",
    thumbnailUrl: item.content?.thumbnail_url || "",
    videoUrl: item.content?.video_url || "",
    genre: item.content?.genre || "",
    contentType: (item.content?.content_type || "movie") as "movie" | "series",
    isPremium: item.content?.is_premium || false,
    duration: item.content?.duration || 0,
    year: item.content?.year,
    // Paid content specific fields
    isPaidContent: true,
    price: item.price,
    currency: item.currency,
    hasPurchased: purchasedContentIds.has(item.content_id),
    creatorName: item.creator_profiles?.display_name,
    creatorAvatar: item.creator_profiles?.avatar_url,
    isFree: item.is_free,
  }));

  if (isLoading) {
    return (
      <section className="group/section relative py-4">
        <div className="px-4 md:px-12 mb-3 flex items-center gap-3">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex gap-2 md:gap-3 overflow-hidden px-4 md:px-12 pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-[160px] aspect-[2/3] rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (contentItems.length === 0) return null;

  return (
    <section className="group/section relative py-4 transition-all duration-300 hover:z-10">
      {/* Section Title */}
      <div className="px-4 md:px-12 mb-3 flex items-center gap-3">
        <ShoppingBag className="h-5 w-5 text-amber-500" />
        <h2 className="font-display text-lg md:text-xl lg:text-2xl text-foreground tracking-wide">
          {title}
        </h2>
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
          {contentItems.map((item) => (
            <div key={item.id} className="relative flex-shrink-0">
              {/* Paid/Purchased Badge */}
              <div className="absolute top-2 right-2 z-10">
                {item.hasPurchased || item.isFree ? (
                  <div className="bg-green-500 rounded-md px-2 py-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-white" />
                    <span className="text-[10px] font-bold text-white">
                      {item.isFree ? "Free" : "Paid Access"}
                    </span>
                  </div>
                ) : (
                  <div className="bg-amber-500 rounded-md px-2 py-1 flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3 text-white" />
                    <span className="text-[10px] font-bold text-white">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: item.currency || 'XAF',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(item.price)}
                    </span>
                  </div>
                )}
              </div>
              <ContentCardWithPreview
                content={item}
                onPlay={onPlay}
                onToggleList={onToggleList}
                onDetails={onDetails}
                isInList={userList.includes(item.id)}
                cardStyle="poster"
              />
              {/* Creator Name */}
              {item.creatorName && (
                <p className="text-xs text-muted-foreground mt-1 truncate px-1">
                  by {item.creatorName}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
