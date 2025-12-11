import { useState, useEffect, useRef } from "react";
import { Search, X, ArrowLeft } from "lucide-react";
import { useContent } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { MobileContentCard } from "./MobileContentCard";
import { cn } from "@/lib/utils";

interface MobileSearchOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: Content) => void;
}

export function MobileSearchOverlay({ open, onClose, onSelect }: MobileSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: content = [] } = useContent();

  // Focus input when overlay opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
    }
  }, [open]);

  // Filter content based on search query
  const searchResults = query.length >= 2
    ? content.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.genre?.toLowerCase().includes(query.toLowerCase()) ||
        c.description?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20)
    : [];

  // Recommended content when no search
  const recommended = content.slice(0, 12);

  if (!open) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-[100] bg-background",
      "animate-in fade-in slide-in-from-top-4 duration-300"
    )}>
      {/* Search Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border/30 pt-safe z-10">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={onClose}
            className="p-2 -ml-2 hover:bg-secondary rounded-xl transition-colors active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search movies, series..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                "w-full h-11 pl-10 pr-10 rounded-xl",
                "bg-secondary/80 border border-border/50",
                "text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
                "transition-all duration-200"
              )}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-background/50 rounded-full"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="overflow-y-auto h-[calc(100vh-80px)] pb-safe">
        {query.length >= 2 ? (
          <div className="p-4">
            {searchResults.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold text-muted-foreground mb-4">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{query}"
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {searchResults.map((item) => (
                    <MobileContentCard
                      key={item.id}
                      content={item}
                      onDetails={onSelect}
                      variant="poster"
                      showBadges={false}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-foreground mb-1">No results found</p>
                <p className="text-sm text-muted-foreground">
                  Try searching for something else
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <h3 className="text-lg font-bold mb-4">Recommended for You</h3>
            <div className="grid grid-cols-3 gap-3">
              {recommended.map((item) => (
                <MobileContentCard
                  key={item.id}
                  content={item}
                  onDetails={(c) => { onSelect(c); onClose(); }}
                  variant="poster"
                  showBadges={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
