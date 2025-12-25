import { Content } from "@/types";
import { Play } from "lucide-react";
import { motion } from "framer-motion";

interface KidsMobileContentCardProps {
  content: Content;
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
  index: number;
  variant?: "default" | "large" | "featured";
}

export const KidsMobileContentCard = ({ 
  content, 
  onPlay, 
  onDetails, 
  index,
  variant = "default" 
}: KidsMobileContentCardProps) => {
  
  const sizes = {
    default: "w-[120px]",
    large: "w-[140px]",
    featured: "w-[200px]",
  };

  return (
    <motion.div
      className={`${sizes[variant]} flex-shrink-0`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.04, 
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
    >
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={() => onDetails(content)}
        className="relative rounded-2xl overflow-hidden bg-white/[0.04] cursor-pointer group"
      >
        <div className={`relative ${variant === "featured" ? "aspect-[16/9]" : "aspect-[2/3]"}`}>
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />

          {/* Rating badge */}
          {content.contentRating && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-white/90 tracking-wide">
                {content.contentRating}
              </span>
            </div>
          )}
        </div>
      </motion.div>
      
      <div className="mt-2.5 px-0.5">
        <h3 className="text-[13px] font-semibold text-white/90 truncate tracking-[-0.01em]">
          {content.title}
        </h3>
        {content.genre && (
          <p className="text-[11px] text-white/40 truncate mt-0.5 font-medium">
            {content.genre}
          </p>
        )}
      </div>
    </motion.div>
  );
};