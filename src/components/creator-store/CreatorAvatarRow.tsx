import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCreatorsWithContent } from "@/hooks/usePaidContent";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatorAvatarRowProps {
  selectedCreator: string;
  onSelectCreator: (creatorId: string) => void;
}

export function CreatorAvatarRow({ selectedCreator, onSelectCreator }: CreatorAvatarRowProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: creators = [], isLoading } = useCreatorsWithContent();

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 200;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-card/50 animate-pulse" />
            <div className="w-14 h-3 bg-card/50 animate-pulse rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (creators.length === 0) return null;

  return (
    <div className="relative group">
      {/* Scroll Buttons */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background backdrop-blur-sm h-8 w-8 rounded-full -ml-4"
        onClick={() => scroll('left')}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background backdrop-blur-sm h-8 w-8 rounded-full -mr-4"
        onClick={() => scroll('right')}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Creators List */}
      <div
        ref={scrollRef}
        className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* All Creators Option */}
        <button
          onClick={() => onSelectCreator('')}
          className="flex flex-col items-center gap-2 flex-shrink-0"
        >
          <div
            className={cn(
              "w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl transition-all",
              "border-2",
              selectedCreator === '' 
                ? "border-primary bg-primary/20 ring-2 ring-primary ring-offset-2 ring-offset-background" 
                : "border-border bg-card hover:border-primary/50"
            )}
          >
            🎬
          </div>
          <span className={cn(
            "text-xs md:text-sm font-medium text-center max-w-[70px] truncate",
            selectedCreator === '' ? "text-primary" : "text-muted-foreground"
          )}>
            All
          </span>
        </button>

        {creators.map((creator: any) => (
          <button
            key={creator.id}
            onClick={() => onSelectCreator(creator.id)}
            onDoubleClick={() => navigate(`/creator/${creator.id}`)}
            className="flex flex-col items-center gap-2 flex-shrink-0"
          >
            <div
              className={cn(
                "relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden transition-all",
                "border-2",
                selectedCreator === creator.id 
                  ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background" 
                  : "border-border hover:border-primary/50"
              )}
            >
              {creator.avatar_url ? (
                <img
                  src={creator.avatar_url}
                  alt={creator.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">
                    {creator.display_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              
              {/* Verified Badge */}
              {creator.is_verified && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5">
                  <CheckCircle className="h-4 w-4 text-primary fill-primary/20" />
                </div>
              )}
            </div>
            <span className={cn(
              "text-xs md:text-sm font-medium text-center max-w-[70px] truncate",
              selectedCreator === creator.id ? "text-primary" : "text-muted-foreground"
            )}>
              {creator.display_name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
