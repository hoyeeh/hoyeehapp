import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PartyMessage {
  id: string;
  party_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_name?: string;
}

interface WatchPartyChatOverlayProps {
  messages: PartyMessage[];
  maxVisible?: number;
  onExpandChat?: () => void;
  isKidsMode?: boolean;
}

export const WatchPartyChatOverlay = ({ 
  messages, 
  maxVisible = 5,
  onExpandChat,
  isKidsMode = false
}: WatchPartyChatOverlayProps) => {
  const [visibleMessages, setVisibleMessages] = useState<PartyMessage[]>([]);
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Track new messages and auto-fade them
  useEffect(() => {
    const recentMessages = messages.slice(-maxVisible);
    
    recentMessages.forEach(msg => {
      if (!processedIdsRef.current.has(msg.id)) {
        processedIdsRef.current.add(msg.id);
        
        // Add message to visible list
        setVisibleMessages(prev => {
          const updated = [...prev, msg].slice(-maxVisible);
          return updated;
        });

        // Remove after 6 seconds
        setTimeout(() => {
          setVisibleMessages(prev => prev.filter(m => m.id !== msg.id));
        }, 6000);
      }
    });
  }, [messages, maxVisible]);

  if (visibleMessages.length === 0) return null;

  return (
    <div 
      className="absolute bottom-24 left-4 right-4 z-40 pointer-events-none"
      onClick={(e) => {
        e.stopPropagation();
        onExpandChat?.();
      }}
    >
      {/* Floating chat messages - Snapchat style from bottom left */}
      <div className="flex flex-col gap-2 max-w-[85%]">
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((msg, index) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20, x: -30 }}
              animate={{ 
                opacity: 1 - (index * 0.1), // Fade older messages slightly
                y: 0, 
                x: 0,
              }}
              exit={{ opacity: 0, y: -10, x: -20 }}
              transition={{ 
                type: "spring", 
                damping: 25, 
                stiffness: 400,
                mass: 0.8
              }}
              className={`rounded-2xl px-3.5 py-2 backdrop-blur-md shadow-lg pointer-events-auto cursor-pointer ${
                isKidsMode 
                  ? 'bg-gradient-to-r from-violet-500/80 to-fuchsia-500/80' 
                  : 'bg-black/60 border border-white/10'
              }`}
              style={{
                // Stagger effect for stacked messages
                transform: `translateY(${index * 2}px)`,
              }}
            >
              <div className="flex items-baseline gap-2">
                <span className={`text-[11px] font-bold shrink-0 ${
                  isKidsMode ? 'text-yellow-200' : 'text-brand'
                }`}>
                  {msg.user_name || 'Guest'}
                </span>
                <p className="text-[13px] text-white leading-snug">
                  {msg.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
