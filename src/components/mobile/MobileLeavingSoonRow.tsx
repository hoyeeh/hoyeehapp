import { Clock } from "lucide-react";
import { Content } from "@/types";
import { MobileContentCard } from "./MobileContentCard";
import { useLeavingSoonContent } from "@/hooks/useLeavingSoonContent";

interface MobileLeavingSoonRowProps {
  onDetails: (content: Content) => void;
  cardSize?: "sm" | "md" | "lg";
  cardStyle?: "poster" | "backdrop" | "wide" | "square" | "minimal" | "full";
  maxItems?: number;
  sectionBannerUrl?: string;
}

export function MobileLeavingSoonRow({ 
  onDetails,
  cardSize = "md",
  cardStyle = "poster",
  maxItems = 15,
  sectionBannerUrl,
}: MobileLeavingSoonRowProps) {
  const { data: content, isLoading } = useLeavingSoonContent(maxItems);

  if (isLoading || !content || content.length === 0) {
    return null;
  }

  return (
    <section className="py-4">
      {/* Section Banner if configured */}
      {sectionBannerUrl && (
        <div className="mx-4 mb-3 rounded-xl overflow-hidden aspect-[21/9] relative">
          <img 
            src={sectionBannerUrl} 
            alt="Leaving Soon" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-destructive" />
            <h4 className="text-sm font-bold">Leaving Soon</h4>
          </div>
        </div>
      )}

      <div className="px-4 mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-bold">Leaving Soon</h2>
          <span className="text-xs text-muted-foreground">
            Watch before they're gone!
          </span>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-4 pb-2">
          {content.map((item) => (
            <MobileContentCard
              key={item.id}
              content={item}
              onDetails={onDetails}
              cardSize={cardSize}
              cardStyle={cardStyle}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
