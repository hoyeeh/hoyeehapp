import { useState, useEffect } from "react";
import { useWatchPartyContextSafe } from "@/contexts/WatchPartyContext";
import { Button } from "@/components/ui/button";

const REACTION_EMOJIS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "😮", label: "Wow" },
  { emoji: "👏", label: "Clap" },
  { emoji: "🔥", label: "Fire" },
];

interface FloatingReaction {
  id: string;
  emoji: string;
  user_name: string;
  x: number;
}

export const MobileWatchPartyReactions = () => {
  const context = useWatchPartyContextSafe();
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  const reactions = context?.reactions ?? [];
  const sendReaction = context?.sendReaction;
  const party = context?.party;

  // Convert reactions to floating display
  useEffect(() => {
    reactions.forEach(reaction => {
      const existing = floatingReactions.find(r => r.id === reaction.id);
      if (!existing) {
        const newFloating: FloatingReaction = {
          id: reaction.id,
          emoji: reaction.emoji,
          user_name: reaction.user_name,
          x: 10 + Math.random() * 30, // Random horizontal position (10-40% from left)
        };
        setFloatingReactions(prev => [...prev, newFloating]);

        // Remove after animation completes
        setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== reaction.id));
        }, 3000);
      }
    });
  }, [reactions]);

  if (!party) return null;

  return (
    <>
      {/* Floating Reactions Overlay - positioned inside video player */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
        {floatingReactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute animate-float-up"
            style={{
              left: `${reaction.x}%`,
              bottom: "20%",
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-3xl drop-shadow-lg">{reaction.emoji}</span>
              <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full mt-0.5 max-w-[60px] truncate">
                {reaction.user_name}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Horizontal Reaction Buttons - positioned at bottom center like desktop */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-row gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
        {REACTION_EMOJIS.map(({ emoji, label }) => (
          <Button
            key={emoji}
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 rounded-full hover:bg-white/20 hover:scale-125 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              sendReaction?.(emoji);
            }}
            title={label}
          >
            <span className="text-2xl">{emoji}</span>
          </Button>
        ))}
      </div>
    </>
  );
};
