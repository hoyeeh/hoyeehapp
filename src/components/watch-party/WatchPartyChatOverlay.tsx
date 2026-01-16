import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";

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
  maxVisible = 4,
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

        // Remove after 5 seconds
        setTimeout(() => {
          setVisibleMessages(prev => prev.filter(m => m.id !== msg.id));
        }, 5000);
      }
    });
  }, [messages, maxVisible]);

  if (visibleMessages.length === 0) return null;

  return (
    <div 
      className="absolute bottom-48 left-4 z-40 max-w-[200px] cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onExpandChat?.();
      }}
    >
      {/* Chat bubble indicator */}
      <div className="flex items-center gap-1.5 mb-2">
        <MessageCircle className="h-3.5 w-3.5 text-white/70" />
        <span className="text-[10px] text-white/60">Tap for full chat</span>
      </div>

      {/* Floating chat messages */}
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className={`rounded-xl px-3 py-2 backdrop-blur-md shadow-lg ${
                isKidsMode 
                  ? 'bg-violet-500/70' 
                  : 'bg-black/70'
              }`}
            >
              <p className={`text-[10px] font-semibold mb-0.5 ${
                isKidsMode ? 'text-yellow-200' : 'text-brand'
              }`}>
                {msg.user_name || 'Guest'}
              </p>
              <p className="text-xs text-white leading-tight line-clamp-2">
                {msg.message}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
