import { Content } from "@/types";
import { Play } from "lucide-react";
import { useKidsSounds } from "@/hooks/useKidsSounds";

interface KidsContentCardProps {
  content: Content;
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
  index: number;
}

export const KidsContentCard = ({ content, onPlay, onDetails, index }: KidsContentCardProps) => {
  const { playPopSound, playHoverSound } = useKidsSounds();

  const colors = [
    "from-pink-500 to-rose-500",
    "from-purple-500 to-violet-500",
    "from-blue-500 to-cyan-500",
    "from-green-500 to-emerald-500",
    "from-yellow-500 to-orange-500",
    "from-red-500 to-pink-500",
  ];

  const borderColor = colors[index % colors.length];

  return (
    <div
      className="group cursor-pointer transform transition-all duration-300 hover:scale-110 hover:-rotate-1"
      onClick={() => {
        playPopSound();
        onDetails(content);
      }}
      onMouseEnter={playHoverSound}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${borderColor} p-1 shadow-lg hover:shadow-2xl transition-shadow animate-bounce-in`}>
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-background">
          <img
            src={content.thumbnailUrl}
            alt={content.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          
          {/* Playful overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                playPopSound();
                onPlay(content);
              }}
              className="bg-white text-black rounded-full p-4 transform scale-0 group-hover:scale-100 transition-transform duration-300 hover:bg-cyan-400 shadow-lg"
            >
              <Play className="h-8 w-8 fill-current" />
            </button>
          </div>

          {/* Sparkle effect */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-2xl animate-pulse">✨</span>
          </div>
        </div>
      </div>
      
      <h3 className="mt-3 text-center font-display text-lg text-white truncate px-2 group-hover:text-cyan-400 transition-colors">
        {content.title}
      </h3>
    </div>
  );
};
