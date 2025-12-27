import { Clock } from "lucide-react";
import { Content } from "@/types";
import { ContentCard } from "./ContentCard";
import { useLeavingSoonContent } from "@/hooks/useLeavingSoonContent";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";

interface LeavingSoonRowProps {
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  myList?: string[];
}

export function LeavingSoonRow({ onPlay, onToggleList, onDetails, myList = [] }: LeavingSoonRowProps) {
  const { data: content, isLoading } = useLeavingSoonContent(15);

  if (isLoading || !content || content.length === 0) {
    return null;
  }

  return (
    <section className="py-6">
      <div className="px-4 md:px-8 lg:px-12">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="h-6 w-6 text-destructive" />
          <h2 className="text-xl md:text-2xl font-display font-bold">
            Leaving Soon
          </h2>
          <span className="text-sm text-muted-foreground">
            Watch before they're gone!
          </span>
        </div>
      </div>
      
      <ScrollArea className="w-full">
        <div className="flex gap-3 md:gap-4 px-4 md:px-8 lg:px-12 pb-4">
          {content.map((item) => (
            <ContentCard
              key={item.id}
              content={item}
              onPlay={onPlay}
              onToggleList={onToggleList}
              onDetails={onDetails}
              isInList={myList.includes(item.id)}
              size="md"
              cardStyle="poster"
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}
