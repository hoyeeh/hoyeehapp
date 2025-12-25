import { useState, useEffect } from "react";
import { useWatchPartyContext } from "@/contexts/WatchPartyContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  y: number;
}

export const WatchPartyReactions = () => {
  const { reactions, sendReaction, party } = useWatchPartyContext();
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  // Convert reactions to floating display
  useEffect(() => {
    reactions.forEach(reaction => {
      const existing = floatingReactions.find(r => r.id === reaction.id);
      if (!existing) {
        const newFloating: FloatingReaction = {
          id: reaction.id,
          emoji: reaction.emoji,
          user_name: reaction.user_name,
          x: 20 + Math.random() * 60, // Random horizontal position (20-80%)
          y: 100 // Start at bottom
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
      {/* Floating Reactions Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[150] overflow-hidden">
        {floatingReactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute animate-float-up"
            style={{
              left: `${reaction.x}%`,
              bottom: "10%",
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-4xl drop-shadow-lg">{reaction.emoji}</span>
              <span className="text-xs bg-black/50 text-white px-2 py-0.5 rounded-full mt-1">
                {reaction.user_name}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Reaction Buttons Bar */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[160] flex gap-2 bg-black/70 backdrop-blur-sm rounded-full px-4 py-2">
        {REACTION_EMOJIS.map(({ emoji, label }) => (
          <Button
            key={emoji}
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 rounded-full hover:bg-white/20 hover:scale-125 transition-all"
            onClick={() => sendReaction(emoji)}
            title={label}
          >
            <span className="text-2xl">{emoji}</span>
          </Button>
        ))}
      </div>
    </>
  );
};
