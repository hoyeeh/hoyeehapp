import React from "react";
import { motion } from "framer-motion";
import { SubtitleCue } from "@/hooks/useSubtitles";
import { cn } from "@/lib/utils";

interface SubtitleDisplayProps {
  cue: SubtitleCue | null;
  className?: string;
  bottomOffset?: number;
}

// Parse subtitle text and render as safe React elements
// This avoids dangerouslySetInnerHTML entirely by parsing formatting tags
const renderSubtitleText = (text: string): React.ReactNode[] => {
  // Split by lines first
  const lines = text.split(/\n|\r\n/);
  
  return lines.map((line, lineIndex) => {
    // Parse each line for formatting tags
    const elements = parseFormattingTags(line);
    
    return (
      <React.Fragment key={lineIndex}>
        {lineIndex > 0 && <br />}
        {elements}
      </React.Fragment>
    );
  });
};

// Parse formatting tags (italic and bold) safely without using innerHTML
const parseFormattingTags = (text: string): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;
  
  // Pattern to match <i>...</i>, <em>...</em>, <b>...</b>, <strong>...</strong>
  const tagPattern = /<(i|em|b|strong)>(.*?)<\/\1>/gi;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  // Reset lastIndex for the regex
  tagPattern.lastIndex = 0;
  
  while ((match = tagPattern.exec(remaining)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const beforeText = remaining.slice(lastIndex, match.index);
      if (beforeText) {
        result.push(<span key={`text-${keyIndex++}`}>{beforeText}</span>);
      }
    }
    
    const tagName = match[1].toLowerCase();
    const content = match[2];
    
    // Recursively parse nested tags in content
    const innerElements = parseFormattingTags(content);
    
    // Render the appropriate element
    if (tagName === 'i' || tagName === 'em') {
      result.push(<em key={`em-${keyIndex++}`}>{innerElements}</em>);
    } else if (tagName === 'b' || tagName === 'strong') {
      result.push(<strong key={`strong-${keyIndex++}`}>{innerElements}</strong>);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last match
  if (lastIndex < remaining.length) {
    const afterText = remaining.slice(lastIndex);
    if (afterText) {
      result.push(<span key={`text-${keyIndex++}`}>{afterText}</span>);
    }
  }
  
  // If no matches were found, return the original text
  if (result.length === 0) {
    return [<span key="text-only">{text}</span>];
  }
  
  return result;
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
      <span className="inline-block bg-black/75 text-white px-3 py-1.5 rounded text-base sm:text-lg leading-relaxed">
        {renderSubtitleText(cue.text)}
      </span>
    </motion.div>
  );
}
