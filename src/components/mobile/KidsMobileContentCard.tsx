import { Content } from "@/types";
import { Play } from "lucide-react";
import { motion } from "framer-motion";
import { useKidsSounds } from "@/hooks/useKidsSounds";
import { useHaptics } from "@/hooks/useHaptics";

interface KidsMobileContentCardProps {
  content: Content;
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
  index: number;
  variant?: "default" | "large" | "wide";
}

const colorPairs = [
  { border: "from-pink-400 to-rose-500", shadow: "shadow-pink-500/20" },
  { border: "from-purple-400 to-violet-500", shadow: "shadow-purple-500/20" },
  { border: "from-cyan-400 to-blue-500", shadow: "shadow-cyan-500/20" },
  { border: "from-amber-400 to-orange-500", shadow: "shadow-amber-500/20" },
  { border: "from-emerald-400 to-green-500", shadow: "shadow-emerald-500/20" },
  { border: "from-indigo-400 to-purple-500", shadow: "shadow-indigo-500/20" },
];

export const KidsMobileContentCard = ({ 
  content, 
  onPlay, 
  onDetails, 
  index,
  variant = "default" 
}: KidsMobileContentCardProps) => {
  const colors = colorPairs[index % colorPairs.length];
  const { playPopSound, playSuccessSound } = useKidsSounds();
  const { lightTap, mediumTap } = useHaptics();
  
  const cardSizes = {
    default: "w-32",
    large: "w-40",
    wide: "w-44",
  };

  const handleCardClick = () => {
    playPopSound();
    lightTap();
    onDetails(content);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSuccessSound();
    mediumTap();
    onPlay(content);
  };

  return (
    <motion.div
      className={`${cardSizes[variant]} flex-shrink-0`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleCardClick}
    >
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${colors.border} p-[2px] ${colors.shadow} shadow-lg`}>
        <div className="relative aspect-[2/3] rounded-[14px] overflow-hidden bg-slate-800">
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Play button */}
          <button
            onClick={handlePlayClick}
            className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg transition-transform active:scale-90"
          >
            <Play className="h-5 w-5 text-slate-900 fill-slate-900 ml-0.5" />
          </button>

          {/* Rating badge */}
          {content.contentRating && (
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm">
              <span className="text-[10px] font-medium text-white/90">{content.contentRating}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-2 px-1">
        <h3 className="text-sm font-medium text-white truncate">
          {content.title}
        </h3>
        {content.genre && (
          <p className="text-xs text-white/50 truncate mt-0.5">
            {content.genre}
          </p>
        )}
      </div>
    </motion.div>
  );
};
