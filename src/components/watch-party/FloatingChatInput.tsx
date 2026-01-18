import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, X } from "lucide-react";
import { useWatchPartyContextSafe } from "@/contexts/WatchPartyContext";
import { cn } from "@/lib/utils";

interface FloatingChatInputProps {
  isKidsMode?: boolean;
  className?: string;
}

export const FloatingChatInput = ({ 
  isKidsMode = false,
  className 
}: FloatingChatInputProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const context = useWatchPartyContextSafe();
  const sendMessage = context?.sendMessage;
  const party = context?.party;

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
        setMessage("");
      }
    };
    
    if (isExpanded) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isExpanded]);

  const handleSend = async () => {
    if (!message.trim() || isSending || !sendMessage) return;
    
    setIsSending(true);
    try {
      await sendMessage(message);
      setMessage("");
      // Keep input open for quick follow-up messages
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!party) return null;

  return (
    <div 
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 z-50",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          // Collapsed: Chat bubble button
          <motion.button
            key="chat-button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={() => setIsExpanded(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-md shadow-lg",
              isKidsMode 
                ? "bg-gradient-to-r from-violet-500/80 to-fuchsia-500/80 text-white" 
                : "bg-black/70 border border-white/20 text-white"
            )}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Chat</span>
          </motion.button>
        ) : (
          // Expanded: Input field
          <motion.div
            key="chat-input"
            initial={{ width: 120, opacity: 0.8 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 120, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-md shadow-lg",
              isKidsMode 
                ? "bg-gradient-to-r from-violet-500/90 to-fuchsia-500/90" 
                : "bg-black/80 border border-white/20"
            )}
          >
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say something..."
              disabled={isSending}
              className={cn(
                "flex-1 bg-transparent text-white text-sm placeholder-white/50 outline-none min-w-0",
                isSending && "opacity-50"
              )}
            />
            
            <div className="flex items-center gap-1">
              {message.trim() ? (
                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className={cn(
                    "p-1.5 rounded-full transition-colors",
                    isKidsMode 
                      ? "bg-white/20 hover:bg-white/30" 
                      : "bg-primary/80 hover:bg-primary"
                  )}
                >
                  <Send className="h-3.5 w-3.5 text-white" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsExpanded(false);
                    setMessage("");
                  }}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-white/70" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

