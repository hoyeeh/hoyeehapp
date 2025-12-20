import { Content } from "@/types";
import { Play, Info, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-lion.jpg";

interface HeroBannerProps {
  content?: Content;
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
  onToggleList: (content: Content) => void;
  isInList: boolean;
}

export const HeroBanner = ({
  content,
  onPlay,
  onDetails,
  onToggleList,
  isInList,
}: HeroBannerProps) => {
  if (!content) {
    return (
      <div className="relative h-[70vh] min-h-[500px] flex items-end">
        <img
          src={heroImage}
          alt="Hoyeeh"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        
        <div className="relative z-10 p-8 md:p-16 max-w-2xl">
          <h1 className="font-display text-5xl md:text-7xl mb-4">Welcome to Hoyeeh</h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            Discover the best African movies and TV shows
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] min-h-[500px] flex items-end">
      {/* Background */}
      <img
        src={content.thumbnailUrl}
        alt={content.title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 p-8 md:p-16 max-w-2xl animate-slide-up">
        
        <h1 className="font-display text-4xl md:text-6xl mb-4">{content.title}</h1>
        
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
          {content.year && <span>{content.year}</span>}
          {content.rating && (
            <span className="border border-muted-foreground/30 px-2 py-0.5 rounded">
              {content.rating}
            </span>
          )}
          <span className="capitalize">{content.contentType}</span>
          <span className="text-brand">{content.genre}</span>
        </div>
        
        <p className="text-muted-foreground mb-6 line-clamp-3 md:line-clamp-4">
          {content.description}
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="brand"
            size="lg"
            onClick={() => onPlay(content)}
            className="gap-2"
          >
            <Play className="h-5 w-5" fill="currentColor" />
            Play
          </Button>
          
          <Button
            variant="secondary"
            size="lg"
            onClick={() => onDetails(content)}
            className="gap-2"
          >
            <Info className="h-5 w-5" />
            More Info
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleList(content)}
            className="h-11 w-11 rounded-full border border-muted-foreground/30"
          >
            {isInList ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
