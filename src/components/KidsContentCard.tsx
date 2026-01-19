import { Content } from "@/types";
import { Play } from "lucide-react";
import { motion } from "framer-motion";

interface KidsContentCardProps {
  content: Content;
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
  index: number;
  hasNewEpisode?: boolean;
  hasNewSeason?: boolean;
}

export const KidsContentCard = ({ content, onPlay, onDetails, index, hasNewEpisode = false, hasNewSeason = false }: KidsContentCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group cursor-pointer"
      onClick={() => onDetails(content)}
    >
      <div className="relative rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.06] shadow-lg hover:shadow-xl transition-all duration-300 hover:border-white/[0.12] hover:scale-[1.02]">
        <div className="relative aspect-[2/3] overflow-hidden">
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Rating badge */}
          {content.contentRating && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
              <span className="text-[11px] font-semibold text-white/90">{content.contentRating}</span>
            </div>
          )}

          {/* New Season Badge - Compact single line */}
          {hasNewSeason && content.contentType === 'series' && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-2 py-0.5 text-[9px] font-bold rounded-full whitespace-nowrap">
              NEW SEASON
            </div>
          )}

          {/* New Episode Badge - Compact single line */}
          {hasNewEpisode && !hasNewSeason && content.contentType === 'series' && (
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-2 py-0.5 text-[9px] font-bold rounded-full whitespace-nowrap">
              NEW EPISODE
            </div>
          )}
        </div>
      </div>
      
      <h3 className="mt-3 text-[14px] font-semibold text-white/90 truncate group-hover:text-white transition-colors tracking-[-0.01em]">
        {content.title}
      </h3>
      {content.genre && (
        <p className="text-[12px] text-white/40 truncate font-medium">{content.genre}</p>
      )}
    </motion.div>
  );
};
