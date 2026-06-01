import { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Film, Tv2 } from "lucide-react";
import { motion } from "framer-motion";
import { Content } from "@/types";
import { MobileGridPoster } from "./MobileGridPoster";
import { TVShowUpdatesMap } from "@/hooks/useLatestTVShowUpdates";
import { cn } from "@/lib/utils";

interface MobileFilteredGridProps {
  title: string;
  content: Content[];
  onDetails: (content: Content) => void;
  onPlay?: (content: Content) => void;
  tvShowUpdates?: TVShowUpdatesMap;
  pageSize?: number;
  icon?: "movie" | "series";
}

/**
 * Paginated grid view (default 30 per page) for the Movies / TV Shows tabs
 * on the mobile home page. Fully responsive 3-column layout that scales
 * gracefully on larger phone / small tablet widths.
 */
export function MobileFilteredGrid({
  title,
  content,
  onDetails,
  onPlay,
  tvShowUpdates = {},
  pageSize = 30,
  icon = "movie",
}: MobileFilteredGridProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(content.length / pageSize));

  // Reset to first page if filter / dataset shrinks
  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
  }, [totalPages, page]);

  // Scroll to top of grid on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const pageItems = useMemo(() => {
    const start = page * pageSize;
    return content.slice(start, start + pageSize);
  }, [content, page, pageSize]);

  const Icon = icon === "series" ? Tv2 : Film;

  if (content.length === 0) {
    return (
      <section className="px-4 py-10 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center mb-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No {title.toLowerCase()} available yet.</p>
      </section>
    );
  }

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, content.length);

  return (
    <section className="pb-8 animate-fade-in">
      {/* Section header */}
      <div className="flex items-end justify-between px-4 pt-2 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center">
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight tracking-tight">{title}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Showing {start}–{end} of {content.length}
            </p>
          </div>
        </div>
        {totalPages > 1 && (
          <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-secondary/60 text-muted-foreground">
            Page {page + 1} / {totalPages}
          </span>
        )}
      </div>

      {/* Responsive grid: 3 cols on phones, 4 on wider phones, 5 on small tablets */}
      <div className="grid grid-cols-3 xs:grid-cols-3 [@media(min-width:480px)]:grid-cols-4 [@media(min-width:640px)]:grid-cols-5 gap-2.5 px-3">
        {pageItems.map((item, idx) => (
          <MobileGridPoster
            key={item.id}
            content={item}
            onDetails={onDetails}
            onPlay={onPlay}
            hasNewEpisode={tvShowUpdates[item.id]?.hasNewEpisode}
            hasNewSeason={tvShowUpdates[item.id]?.hasNewSeason}
            index={idx}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 px-4 mt-6">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className={cn(
              "flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-medium",
              "bg-secondary/60 border border-border/40 active:scale-95 transition-all",
              "disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          {/* Page dots */}
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar max-w-[50%]">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Go to page ${i + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all flex-shrink-0",
                  i === page
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>

          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className={cn(
              "flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-medium",
              "bg-primary text-primary-foreground active:scale-95 transition-all",
              "disabled:opacity-40 disabled:pointer-events-none"
            )}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}
