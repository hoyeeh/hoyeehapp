import { ChevronRight, ShoppingBag, CheckCircle } from "lucide-react";
import { Content } from "@/types";
import { MobileContentCard } from "./MobileContentCard";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaidContentForHome, useUserPurchases } from "@/hooks/usePaidContent";
import { useNavigate } from "react-router-dom";

interface MobilePaidContentRowProps {
  title?: string;
  onDetails: (content: Content) => void;
  maxItems?: number;
}

export function MobilePaidContentRow({
  title = "Creator Studio",
  onDetails,
  maxItems = 15,
}: MobilePaidContentRowProps) {
  const navigate = useNavigate();
  const { data: paidContent = [], isLoading } = usePaidContentForHome();
  const { data: purchases = [] } = useUserPurchases();

  // Create a set of purchased content IDs for quick lookup
  const purchasedContentIds = new Set(purchases.map((p) => p.content_id));

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
    createdAt: item.content?.created_at,
    // Paid content specific fields
    isPaidContent: true,
    price: item.price,
    currency: item.currency,
    hasPurchased: purchasedContentIds.has(item.content_id),
    isFree: item.is_free,
  }));

  if (isLoading) {
    return (
      <section className="mb-6">
        <div className="flex items-center justify-between px-4 mb-3">
          <Skeleton className="h-6 w-32 rounded" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
        <div className="flex gap-3 overflow-hidden px-4 pb-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex-shrink-0 w-[120px]">
              <Skeleton className="w-full aspect-[2/3] rounded-lg" />
              <Skeleton className="h-3 w-3/4 mt-2 rounded" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (contentItems.length === 0) return null;

  return (
    <section className="mb-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-amber-500" />
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
        </div>
        <button 
          onClick={() => navigate("/creator-store")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors active:scale-95"
        >
          See All
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className={cn(
        "flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar",
        "scroll-smooth snap-x snap-mandatory"
      )}>
        {contentItems.map((item) => (
          <div key={item.id} className="snap-start">
            <MobileContentCard
              content={item as Content}
              onDetails={onDetails}
              variant="poster"
              isPaidContent={true}
              hasPurchased={item.hasPurchased || item.isFree}
              price={item.isFree ? undefined : item.price}
              currency={item.currency}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
