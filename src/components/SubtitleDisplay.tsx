import { motion } from "framer-motion";
import { SubtitleCue } from "@/hooks/useSubtitles";
import { cn } from "@/lib/utils";

interface SubtitleDisplayProps {
  cue: SubtitleCue | null;
  className?: string;
  bottomOffset?: number;
}

export function SubtitleDisplay({ 
  cue, 
  className,
  bottomOffset = 80,
}: SubtitleDisplayProps) {
  if (!cue) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "absolute left-1/2 -translate-x-1/2 max-w-[80%] text-center pointer-events-none z-30",
        className
      )}
      style={{ bottom: `${bottomOffset}px` }}
    >
      <span
        className="inline-block bg-black/75 text-white px-3 py-1.5 rounded text-base sm:text-lg leading-relaxed"
        dangerouslySetInnerHTML={{ 
          __html: cue.text
            .replace(/\n/g, '<br />')
            .replace(/<i>/g, '<em>')
            .replace(/<\/i>/g, '</em>')
            .replace(/<b>/g, '<strong>')
            .replace(/<\/b>/g, '</strong>')
        }}
      />
    </motion.div>
  );
}
