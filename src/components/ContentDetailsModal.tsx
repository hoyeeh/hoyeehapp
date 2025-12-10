import { Content } from "@/types";
import { X, Play, Plus, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "./DownloadButton";

interface ContentDetailsModalProps {
  content: Content;
  onClose: () => void;
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  isInList: boolean;
}

export const ContentDetailsModal = ({
  content,
  onClose,
  onPlay,
  onToggleList,
  isInList,
}: ContentDetailsModalProps) => {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl bg-card border border-border animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Hero Image */}
        <div className="relative h-64 md:h-80">
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
          
          {content.isPremium && (
            <div className="absolute top-4 left-4 bg-brand px-3 py-1 rounded text-sm font-semibold text-primary-foreground">
              PREMIUM
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 -mt-16 relative">
          <h2 className="font-display text-3xl md:text-4xl mb-2">{content.title}</h2>
          
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
            {content.year && <span>{content.year}</span>}
            {content.rating && (
              <span className="border border-muted-foreground/30 px-2 py-0.5 rounded">
                {content.rating}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(content.duration)}
            </span>
            <span className="capitalize">{content.contentType}</span>
            <span className="text-brand">{content.genre}</span>
          </div>

          <p className="text-muted-foreground mb-6 leading-relaxed">
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
              Play Now
            </Button>
            
            <Button
              variant="secondary"
              size="lg"
              onClick={() => onToggleList(content)}
              className="gap-2"
            >
              {isInList ? (
                <>
                  <Check className="h-5 w-5" />
                  In My List
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Add to List
                </>
              )}
            </Button>

            <DownloadButton content={content} />
          </div>
        </div>
      </div>
    </div>
  );
};
