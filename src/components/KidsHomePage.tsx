import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsContentCard } from "./KidsContentCard";
import { LoadingSpinner } from "./LoadingSpinner";
import { Sparkles, Star, Heart, Rocket, Gamepad2 } from "lucide-react";
import { useKidsSounds } from "@/hooks/useKidsSounds";

interface KidsHomePageProps {
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
}

// Filter for kids-appropriate content (G and PG ratings only)
const KIDS_RATINGS = ["G", "PG", "TV-G", "TV-Y", "TV-Y7", "TV-PG"];

export const KidsHomePage = ({ onPlay, onDetails }: KidsHomePageProps) => {
  const { playSuccessSound } = useKidsSounds();

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

  // Categorize content
  const movies = kidsContent.filter((c) => c.contentType === "movie");
  const shows = kidsContent.filter((c) => c.contentType === "series");
  const animation = kidsContent.filter((c) => 
    c.genre?.toLowerCase().includes("animation") || 
    c.genre?.toLowerCase().includes("cartoon")
  );
  const adventure = kidsContent.filter((c) => 
    c.genre?.toLowerCase().includes("adventure") || 
    c.genre?.toLowerCase().includes("action")
  );

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

  const sections = [
    { title: "Watch Now!", icon: Rocket, content: kidsContent.slice(0, 10), color: "text-pink-400" },
    { title: "Movies", icon: Star, content: movies.slice(0, 10), color: "text-yellow-400" },
    { title: "TV Shows", icon: Gamepad2, content: shows.slice(0, 10), color: "text-green-400" },
    { title: "Cartoons", icon: Heart, content: animation.slice(0, 10), color: "text-purple-400" },
    { title: "Adventures", icon: Rocket, content: adventure.slice(0, 10), color: "text-cyan-400" },
  ].filter((section) => section.content.length > 0);

  return (
    <div className="px-4 md:px-8 space-y-12 pb-24">
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
            🎬 Welcome to Kids Zone! 🌟
          </h1>
          <p className="text-white/90 text-lg md:text-xl max-w-2xl mx-auto">
            Discover amazing shows and movies just for you!
          </p>
        </div>
      </div>

      {/* Content Sections */}
      {sections.map((section, sectionIndex) => (
        <section key={section.title} className="relative">
          <div className="flex items-center gap-3 mb-6">
            <section.icon className={`h-8 w-8 ${section.color} animate-bounce-slow`} />
            <h2 className="font-display text-2xl md:text-3xl text-white">
              {section.title}
            </h2>
            <div className="flex-1 h-1 bg-gradient-to-r from-current to-transparent opacity-30 rounded-full" style={{ color: section.color.replace("text-", "") }} />
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
