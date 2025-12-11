import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsContentCard } from "./KidsContentCard";
import { Sparkles, Clock } from "lucide-react";
import { useKidsSounds } from "@/hooks/useKidsSounds";
import { useKidsTimeLimit } from "@/hooks/useKidsTimeLimit";
import { useProfileContext } from "@/contexts/ProfileContext";

interface KidsHomePageProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

// Filter for kids-appropriate content (G and PG ratings only)
const KIDS_RATINGS = ["G", "PG", "TV-G", "TV-Y", "TV-Y7", "TV-PG"];

export const KidsHomePage = ({ onPlay, onDetails }: KidsHomePageProps) => {
  const { playSuccessSound } = useKidsSounds();
  const { currentProfile } = useProfileContext();
  const { timeRemaining, isTimeLimitReached } = useKidsTimeLimit();

  // Fetch kids-appropriate content
  const { data: kidsContent = [], isLoading } = useQuery({
    queryKey: ["kids-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .in("content_rating", KIDS_RATINGS)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description || "",
        thumbnailUrl: item.thumbnail_url || "",
        videoUrl: item.video_url || "",
        genre: item.genre || "",
        contentType: item.content_type as "movie" | "series",
        isPremium: item.is_premium || false,
        duration: item.duration || 0,
        year: item.year,
        contentRating: item.content_rating,
      })) as Content[];
    },
  });

  // Fetch kids categories
  const { data: kidsCategories = [] } = useQuery({
    queryKey: ["kids-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch category mappings
  const { data: categoryMappings = [] } = useQuery({
    queryKey: ["kids-content-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kids_content_categories")
        .select("content_id, category_id");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get content for a category
  const getContentForCategory = (categoryId: string): Content[] => {
    const contentIds = categoryMappings
      .filter((m: any) => m.category_id === categoryId)
      .map((m: any) => m.content_id);
    
    return kidsContent.filter((c) => contentIds.includes(c.id));
  };

  // Categorize remaining content by genre
  const movies = kidsContent.filter((c) => c.contentType === "movie");
  const shows = kidsContent.filter((c) => c.contentType === "series");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-bounce-slow">
            <Sparkles className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
          </div>
          <p className="text-xl text-white font-display animate-pulse">Loading fun stuff...</p>
        </div>
      </div>
    );
  }

  // Time limit reached screen
  if (isTimeLimitReached) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-6 animate-bounce-slow">😴</div>
          <h1 className="text-3xl md:text-4xl font-display text-white mb-4">
            Time's Up for Today!
          </h1>
          <p className="text-white/80 text-lg mb-6">
            You've watched all your shows for today. Come back tomorrow for more fun!
          </p>
          <div className="text-6xl animate-float">🌙 💤 ⭐</div>
        </div>
      </div>
    );
  }

  // Build sections from categories
  const categorySections = kidsCategories.map((category: any) => ({
    title: category.name,
    emoji: category.emoji,
    content: getContentForCategory(category.id),
    color: category.color,
  })).filter((s) => s.content.length > 0);

  // Add default sections
  const defaultSections = [
    { title: "Watch Now!", emoji: "🎬", content: kidsContent.slice(0, 10), color: "from-pink-500 to-rose-500" },
    { title: "Movies", emoji: "🍿", content: movies.slice(0, 10), color: "from-yellow-500 to-orange-500" },
    { title: "TV Shows", emoji: "📺", content: shows.slice(0, 10), color: "from-green-500 to-emerald-500" },
  ].filter((s) => s.content.length > 0);

  const allSections = [...categorySections, ...defaultSections];

  return (
    <div className="px-4 md:px-8 space-y-12 pb-24">
      {/* Time Remaining Banner */}
      {timeRemaining !== null && (
        <div className="bg-gradient-to-r from-purple-600/80 to-pink-600/80 rounded-2xl p-4 flex items-center justify-center gap-3 backdrop-blur-sm">
          <Clock className="h-6 w-6 text-white animate-pulse" />
          <span className="text-white font-medium">
            {timeRemaining > 0 
              ? `${timeRemaining} minutes of watch time left today!`
              : "Watch time is almost up!"}
          </span>
          <span className="text-2xl">⏰</span>
        </div>
      )}

      {/* Animated Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-400 p-8 md:p-12 mt-4">
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating bubbles */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white/20 animate-float"
              style={{
                width: `${20 + Math.random() * 40}px`,
                height: `${20 + Math.random() * 40}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
        
        <div className="relative z-10 text-center">
          <h1 className="font-display text-4xl md:text-6xl text-white mb-4 animate-bounce-slow">
            🎬 Welcome{currentProfile?.name ? `, ${currentProfile.name}` : ""}! 🌟
          </h1>
          <p className="text-white/90 text-lg md:text-xl max-w-2xl mx-auto">
            Discover amazing shows and movies just for you!
          </p>
        </div>
      </div>

      {/* Kids Categories */}
      {kidsCategories.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4">
          {kidsCategories.map((category: any) => (
            <button
              key={category.id}
              className={`px-6 py-3 rounded-full bg-gradient-to-r ${category.color} text-white font-medium text-lg shadow-lg hover:scale-105 transition-transform flex items-center gap-2`}
              onClick={() => {
                const section = document.getElementById(`category-${category.slug}`);
                section?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <span className="text-2xl">{category.emoji}</span>
              {category.name}
            </button>
          ))}
        </div>
      )}

      {/* Content Sections */}
      {allSections.map((section, sectionIndex) => (
        <section 
          key={section.title} 
          id={`category-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
          className="relative"
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl animate-bounce-slow">{section.emoji}</span>
            <h2 className="font-display text-2xl md:text-3xl text-white">
              {section.title}
            </h2>
            <div className="flex-1 h-1 bg-gradient-to-r from-white/30 to-transparent rounded-full" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {section.content.map((item, index) => (
              <KidsContentCard
                key={item.id}
                content={item}
                onPlay={onPlay}
                onDetails={onDetails}
                index={sectionIndex * 10 + index}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Empty State */}
      {kidsContent.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4 animate-bounce">🎈</div>
          <h2 className="text-2xl text-white font-display mb-2">No shows yet!</h2>
          <p className="text-white/70">Check back soon for awesome content!</p>
        </div>
      )}
    </div>
  );
};
