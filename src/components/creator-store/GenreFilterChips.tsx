import { usePaidContentGenres } from "@/hooks/usePaidContent";
import { cn } from "@/lib/utils";
import { 
  Flame, 
  Laugh, 
  Theater, 
  Ghost, 
  Heart, 
  Rocket, 
  AlertTriangle, 
  Video, 
  Sparkles, 
  Wand2,
  Mountain,
  Search,
  Music,
  Users,
  Target,
  Swords,
  Scroll,
  Trophy,
  Sun,
  Mic,
  Film
} from "lucide-react";

interface GenreFilterChipsProps {
  selectedGenre: string;
  onSelectGenre: (genre: string) => void;
}

// Colorful gradients for different genres
const genreColors: Record<string, string> = {
  "Action": "from-red-500 to-orange-500",
  "Comedy": "from-yellow-400 to-amber-500",
  "Drama": "from-purple-500 to-pink-500",
  "Horror": "from-gray-700 to-red-900",
  "Romance": "from-pink-400 to-rose-500",
  "Sci-Fi": "from-cyan-400 to-blue-500",
  "Thriller": "from-slate-600 to-zinc-800",
  "Documentary": "from-emerald-500 to-teal-500",
  "Animation": "from-violet-400 to-fuchsia-500",
  "Fantasy": "from-indigo-500 to-purple-600",
  "Adventure": "from-green-500 to-emerald-600",
  "Mystery": "from-slate-500 to-indigo-600",
  "Music": "from-pink-500 to-violet-500",
  "Family": "from-sky-400 to-blue-500",
  "Crime": "from-zinc-600 to-neutral-800",
  "War": "from-stone-600 to-amber-700",
  "History": "from-amber-600 to-yellow-700",
  "Sports": "from-lime-500 to-green-600",
  "Western": "from-orange-600 to-amber-700",
  "Musical": "from-fuchsia-500 to-pink-600",
};

// Icons for genres
const genreIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "Action": Flame,
  "Comedy": Laugh,
  "Drama": Theater,
  "Horror": Ghost,
  "Romance": Heart,
  "Sci-Fi": Rocket,
  "Thriller": AlertTriangle,
  "Documentary": Video,
  "Animation": Sparkles,
  "Fantasy": Wand2,
  "Adventure": Mountain,
  "Mystery": Search,
  "Music": Music,
  "Family": Users,
  "Crime": Target,
  "War": Swords,
  "History": Scroll,
  "Sports": Trophy,
  "Western": Sun,
  "Musical": Mic,
};

function getGradient(genre: string): string {
  return genreColors[genre] || "from-primary/80 to-primary";
}

function getIcon(genre: string): React.ComponentType<{ className?: string }> {
  return genreIcons[genre] || Film;
}

export function GenreFilterChips({ selectedGenre, onSelectGenre }: GenreFilterChipsProps) {
  const { data: genres = [], isLoading } = usePaidContentGenres();

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 w-24 rounded-full bg-card/50 animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (genres.length === 0) return null;

  return (
    <div 
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {/* All Genres Chip */}
      <button
        onClick={() => onSelectGenre('')}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
          "border flex-shrink-0",
          selectedGenre === ''
            ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-primary shadow-lg shadow-primary/25"
            : "bg-card/50 text-foreground border-border/50 hover:border-primary/50 hover:bg-card"
        )}
      >
        <Film className="h-4 w-4" />
        <span>All Genres</span>
      </button>

      {/* Genre Chips */}
      {genres.map((genre) => {
        const IconComponent = getIcon(genre);
        return (
          <button
            key={genre}
            onClick={() => onSelectGenre(genre === selectedGenre ? '' : genre)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              "border flex-shrink-0",
              selectedGenre === genre
                ? `bg-gradient-to-r ${getGradient(genre)} text-white border-transparent shadow-lg`
                : "bg-card/50 text-foreground border-border/50 hover:border-primary/50 hover:bg-card"
            )}
          >
            <IconComponent className="h-4 w-4" />
            <span>{genre}</span>
          </button>
        );
      })}
    </div>
  );
}
