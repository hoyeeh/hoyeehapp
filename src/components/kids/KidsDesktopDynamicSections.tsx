import { Content } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Film, Tv, TrendingUp, Sparkles, Youtube, Clock, Star, Clapperboard, LucideIcon } from "lucide-react";
import { KidsContentCard } from "@/components/KidsContentCard";
import { useNavigate } from "react-router-dom";
import { useLatestTVShowUpdates } from "@/hooks/useLatestTVShowUpdates";
import { KIDS_RATINGS, KIDS_MAX_AGE_LIMIT, isBlockedTitle, isKidsAllowedGenre } from "@/constants/kidsRatings";
import { KidsYouTubeRow } from "./KidsYouTubeRow";

interface KidsDesktopDynamicSectionsProps {
  allContent: Content[];
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
  onPlayVideo?: (videoId: string, title: string) => void;
}

// Section header component
const SectionHeader = ({ 
  icon: Icon, 
  title, 
  color 
}: { 
  icon: LucideIcon; 
  title: string; 
  color: string;
}) => (
  <div className="flex items-center gap-3 mb-6">
    <div className={`w-10 h-10 rounded-2xl ${color} flex items-center justify-center shadow-lg`}>
      <Icon className="h-5 w-5 text-white" strokeWidth={2} />
    </div>
    <h2 className="text-xl font-semibold text-white tracking-[-0.02em]">{title}</h2>
  </div>
);

// Map section types to colors and icons
const sectionColors: Record<string, { bg: string; border: string; icon: string }> = {
  movie: { bg: "from-blue-500/20 via-blue-500/10 to-cyan-500/20", border: "border-blue-500/20", icon: "bg-gradient-to-br from-blue-500 to-cyan-600" },
  series: { bg: "from-emerald-500/20 via-emerald-500/10 to-green-500/20", border: "border-emerald-500/20", icon: "bg-gradient-to-br from-emerald-500 to-green-600" },
  recently_added: { bg: "from-amber-500/20 via-amber-500/10 to-orange-500/20", border: "border-amber-500/20", icon: "bg-gradient-to-br from-amber-500 to-orange-600" },
  new_releases: { bg: "from-amber-500/20 via-amber-500/10 to-orange-500/20", border: "border-amber-500/20", icon: "bg-gradient-to-br from-amber-500 to-orange-600" },
  genre: { bg: "from-fuchsia-500/20 via-fuchsia-500/10 to-purple-500/20", border: "border-fuchsia-500/20", icon: "bg-gradient-to-br from-fuchsia-500 to-purple-600" },
  curated: { bg: "from-pink-500/20 via-pink-500/10 to-rose-500/20", border: "border-pink-500/20", icon: "bg-gradient-to-br from-pink-500 to-rose-600" },
  free_content: { bg: "from-teal-500/20 via-teal-500/10 to-cyan-500/20", border: "border-teal-500/20", icon: "bg-gradient-to-br from-teal-500 to-cyan-600" },
  youtube: { bg: "from-red-500/20 via-red-500/10 to-orange-500/20", border: "border-red-500/20", icon: "bg-gradient-to-br from-red-500 to-orange-600" },
  trending: { bg: "from-rose-500/20 via-rose-500/10 to-pink-500/20", border: "border-rose-500/20", icon: "bg-gradient-to-br from-rose-500 to-pink-600" },
  default: { bg: "from-violet-500/20 via-violet-500/10 to-purple-500/20", border: "border-violet-500/20", icon: "bg-gradient-to-br from-violet-500 to-purple-600" },
};

const sectionIcons: Record<string, LucideIcon> = {
  movie: Film,
  series: Tv,
  recently_added: Clock,
  new_releases: Sparkles,
  genre: Clapperboard,
  curated: Star,
  free_content: Sparkles,
  youtube: Youtube,
  trending: TrendingUp,
  default: Sparkles,
};

export const KidsDesktopDynamicSections = ({ 
  allContent, 
  onPlay, 
  onDetails, 
  onPlayVideo 
}: KidsDesktopDynamicSectionsProps) => {
  const navigate = useNavigate();

  // Fetch home sections configured for kids
  const { data: kidsSections = [] } = useQuery({
    queryKey: ["kids-home-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_sections")
        .select("*, genre:genre_id(name)")
        .eq("is_active", true)
        .eq("show_on_kids", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch section content for curated sections
  const { data: sectionContentData = [] } = useQuery({
    queryKey: ["kids-section-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_content")
        .select("*, content:content_id(*)");
      if (error) throw error;
      return data || [];
    },
  });

  // Get TV show IDs for badges
  const tvShowIds = useMemo(() => 
    allContent.filter(c => c.contentType === 'series').map(c => c.id),
    [allContent]
  );
  const { data: tvShowUpdates = {} } = useLatestTVShowUpdates(tvShowIds);

  // Transform content from DB format
  const transformContent = (items: any[]): Content[] =>
    items.map((item) => ({
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
      age_limit: item.age_limit,
    }));

  // Filter content for kids safety
  const filterForKids = (items: Content[]): Content[] => {
    return items.filter(item => {
      const rating = (item as any).contentRating;
      const ageLimit = (item as any).age_limit;
      const ratingOk = !rating || KIDS_RATINGS.includes(rating);
      const ageOk = !ageLimit || ageLimit <= KIDS_MAX_AGE_LIMIT;
      const notBlocked = !isBlockedTitle(item.title || "");
      const genreOk = isKidsAllowedGenre(item.genre);
      return ratingOk && ageOk && notBlocked && genreOk;
    });
  };

  // Get content for a section
  const getSectionContent = (section: any): Content[] => {
    const movies = allContent.filter(c => c.contentType === "movie");
    const series = allContent.filter(c => c.contentType === "series");
    
    if (section.section_type === "curated") {
      const curatedItems = sectionContentData
        .filter((sc: any) => sc.section_id === section.id && sc.content)
        .map((sc: any) => transformContent([sc.content])[0]);
      return filterForKids(curatedItems).slice(0, section.max_items || 12);
    }
    
    if (section.section_type === "genre" && section.genre) {
      return filterForKids(
        allContent.filter(c => 
          c.genre?.toLowerCase().includes(section.genre.name.toLowerCase())
        )
      ).sort((a, b) => (b.year || 0) - (a.year || 0))
       .slice(0, section.max_items || 12);
    }
    
    if (section.section_type === "movie" || section.content_type_filter === "movie") {
      return filterForKids(movies)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, section.max_items || 12);
    }
    
    if (section.section_type === "series" || section.content_type_filter === "series") {
      return filterForKids(series)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, section.max_items || 12);
    }
    
    if (section.section_type === "recently_added" || section.section_type === "new_releases") {
      return filterForKids(allContent)
        .sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, section.max_items || 12);
    }

    if (section.section_type === "free_content") {
      if (section.is_curated) {
        const curatedFree = sectionContentData
          .filter((sc: any) => sc.section_id === section.id && sc.content && !sc.content.is_premium)
          .map((sc: any) => transformContent([sc.content])[0]);
        return filterForKids(curatedFree).slice(0, section.max_items || 12);
      }
      let freeFiltered = allContent.filter((c) => !c.isPremium);
      if (section.content_type_filter === "movie") {
        freeFiltered = freeFiltered.filter((c) => c.contentType === "movie");
      } else if (section.content_type_filter === "series") {
        freeFiltered = freeFiltered.filter((c) => c.contentType === "series");
      }
      return filterForKids(freeFiltered)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, section.max_items || 12);
    }

    if (section.section_type === "youtube") {
      return []; // Handled separately
    }
    
    // Default: return all filtered content
    let filtered = [...allContent];
    if (section.content_type_filter === "movie") {
      filtered = movies;
    } else if (section.content_type_filter === "series") {
      filtered = series;
    }
    
    return filterForKids(filtered)
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, section.max_items || 12);
  };

  if (kidsSections.length === 0) {
    return null;
  }

  return (
    <>
      {kidsSections.map((section: any, sectionIndex: number) => {
        const sectionType = section.section_type || "default";
        const colors = sectionColors[sectionType] || sectionColors.default;
        const Icon = sectionIcons[sectionType] || sectionIcons.default;

        // Handle YouTube section separately
        if (sectionType === "youtube") {
          if (!onPlayVideo) return null;
          return (
            <KidsYouTubeRow 
              key={section.id} 
              onPlayVideo={onPlayVideo} 
            />
          );
        }

        // Skip continue_watching and my_list (handled elsewhere)
        if (sectionType === "continue_watching" || sectionType === "my_list") {
          return null;
        }

        const sectionContent = getSectionContent(section);
        if (sectionContent.length === 0) return null;

        return (
          <motion.section 
            key={section.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, ease: "easeOut", delay: sectionIndex * 0.05 }}
            className={`bg-gradient-to-br ${colors.bg} rounded-2xl p-4 md:p-6 border ${colors.border}`}
          >
            <SectionHeader 
              icon={Icon} 
              title={section.title} 
              color={colors.icon}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {sectionContent.map((item, index) => (
                <KidsContentCard
                  key={item.id}
                  content={item}
                  onPlay={onPlay}
                  onDetails={onDetails}
                  index={index}
                />
              ))}
            </div>
          </motion.section>
        );
      })}
    </>
  );
};
