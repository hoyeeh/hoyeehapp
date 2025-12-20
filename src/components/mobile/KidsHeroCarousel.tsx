import { useState, useEffect, useCallback } from "react";
import { Content } from "@/types";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface KidsHeroCarouselProps {
  content: Content[];
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

export const KidsHeroCarousel = ({ content, onPlay, onDetails }: KidsHeroCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const featuredContent = content.slice(0, 5);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % featuredContent.length);
  }, [featuredContent.length]);

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + featuredContent.length) % featuredContent.length);
  };

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (featuredContent.length <= 1) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [nextSlide, featuredContent.length]);

  if (featuredContent.length === 0) return null;

  const current = featuredContent[currentIndex];

  return (
    <div className="relative mx-5 mt-4 rounded-3xl overflow-hidden bg-gradient-to-br from-[#1a1a2e] to-[#16162a]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative aspect-[16/9]"
        >
          {/* Background Image */}
          <div className="absolute inset-0">
            <img
              src={current.thumbnailUrl}
              alt={current.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0F]/80 via-transparent to-transparent" />
          </div>

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {current.contentRating && (
                <span className="inline-block px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm text-[11px] font-semibold text-white/80 mb-2">
                  {current.contentRating}
                </span>
              )}
              <h2 className="text-xl font-bold text-white tracking-[-0.02em] mb-1.5 line-clamp-1">
                {current.title}
              </h2>
              <p className="text-[13px] text-white/60 line-clamp-2 mb-4 font-medium">
                {current.description}
              </p>

              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onPlay(current)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0A0A0F] text-[13px] font-semibold"
                >
                  <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                  Play Now
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onDetails(current)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm text-white text-[13px] font-semibold border border-white/10"
                >
                  More Info
                </motion.button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {featuredContent.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {featuredContent.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {featuredContent.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? "w-6 bg-white" 
                  : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
