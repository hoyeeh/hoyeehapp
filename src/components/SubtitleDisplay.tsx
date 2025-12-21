import { motion } from "framer-motion";
import DOMPurify from "dompurify";
import { SubtitleCue } from "@/hooks/useSubtitles";
import { cn } from "@/lib/utils";

interface SubtitleDisplayProps {
  cue: SubtitleCue | null;
  className?: string;
  bottomOffset?: number;
}

// Sanitize subtitle text to prevent XSS attacks
const sanitizeSubtitleText = (text: string): string => {
  // First apply standard subtitle formatting replacements
  const formattedText = text
    .replace(/\n/g, '<br />')
    .replace(/<i>/g, '<em>')
    .replace(/<\/i>/g, '</em>')
    .replace(/<b>/g, '<strong>')
    .replace(/<\/b>/g, '</strong>');
  
  // Then sanitize with DOMPurify, only allowing safe subtitle tags
  return DOMPurify.sanitize(formattedText, {
    ALLOWED_TAGS: ['br', 'em', 'strong', 'i', 'b'],
    ALLOWED_ATTR: [],
  });
};

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
          __html: sanitizeSubtitleText(cue.text)
        }}
      />
    </motion.div>
  );
}
