import { Play } from "lucide-react";
import { motion } from "framer-motion";
import { Content } from "@/types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import badge from "@/assets/hoyeeh-badge.png";

interface MobileGridPosterProps {
  content: Content;
  onDetails: (content: Content) => void;
  onPlay?: (content: Content) => void;
  hasNewEpisode?: boolean;
  hasNewSeason?: boolean;
  index?: number;
}

/**
 * Lightweight, fully responsive (w-full) poster card for use inside
 * CSS grids. Always honors its parent's width, with a strict 2:3
 * aspect ratio so cover images render in correct proportion at any
 * screen size.
 */
export function MobileGridPoster({
  content,
  onDetails,
  hasNewEpisode = false,
  hasNewSeason = false,
  index = 0,
}: MobileGridPosterProps) {
  const [imgError, setImgError] = useState(false);
  const src = imgError || !content.thumbnailUrl ? "/placeholder.svg" : content.thumbnailUrl;

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.012, 0.3) }}
      onClick={() => onDetails(content)}
      className="group relative w-full text-left active:scale-[0.97] transition-transform"
    >
      {/* 2:3 cover - fully responsive */}
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-secondary shadow-md ring-1 ring-border/10">
        <img
          src={src}
          alt={content.title}
          loading="lazy"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Gradient overlay for title legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />

        {/* Brand badge */}
        <img
          src={badge}
          alt=""
          aria-hidden
          className="absolute top-1.5 left-1.5 h-3 w-auto opacity-80"
          onError={(e) => ((e.currentTarget.style.display = "none"))}
        />

        {/* Premium chip */}
        {content.isPremium && (
          <span className="absolute top-1.5 right-1.5 text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-primary text-primary-foreground shadow">
            PREMIUM
          </span>
        )}

        {/* TV-show update chips */}
        {(hasNewEpisode || hasNewSeason) && (
          <span className="absolute bottom-9 left-1.5 text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-rose-500 text-white shadow">
            {hasNewSeason ? "NEW SEASON" : "NEW EP"}
          </span>
        )}

        {/* Title at bottom */}
        <div className="absolute inset-x-0 bottom-0 p-2">
          <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2 drop-shadow">
            {content.title}
          </p>
        </div>

        {/* Hover play overlay */}
        <div className={cn(
          "absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/30"
        )}>
          <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center">
            <Play className="h-4 w-4 text-black ml-0.5" fill="currentColor" />
          </div>
        </div>
      </div>
    </motion.button>
  );
}
