import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { KidsMobileContentCard } from "@/components/mobile/KidsMobileContentCard";
import { motion } from "framer-motion";
import { Film, Tv, Sparkles, TrendingUp, Star, Heart, Gamepad2, Music, Radio, Gift } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isKidsContentAllowed } from "@/constants/kidsRatings";
import { useLatestTVShowUpdates } from "@/hooks/useLatestTVShowUpdates";
import { useMemo } from "react";
import { applyAdminFilters } from "@/lib/homeSectionFilters";
import { orderHomepageContent } from "@/lib/homeContentOrdering";
import { KidsMobileYouTubeRow } from "@/components/kids/KidsMobileYouTubeRow";

interface KidsDynamicSectionsProps {
  allContent: Content[];
  onPlay: (content: Content) => void;
  onDetails: (content: Content) => void;
  onPlayVideo?: (videoId: string, title: string) => void;
}

// Icon mapping for section types
const sectionIcons: Record<string, typeof Film> = {
  movie: Film,
  series: Tv,
  animation: Sparkles,
  trending: TrendingUp,
  new_releases: Star,
  recently_added: Star,
  genre: Heart,
  curated: Sparkles,
  free_content: Gift,
  youtube: Radio,
  default: Music,
};

// Color gradients for sections
const sectionColors: Record<string, { bg: string; icon: string; border: string }> = {
  movie: { 
    bg: "from-blue-500/20 via-blue-500/10 to-cyan-500/20", 
    icon: "bg-gradient-to-br from-blue-500 to-cyan-600",
    border: "border-blue-500/20"
  },
  series: { 
    bg: "from-emerald-500/20 via-emerald-500/10 to-green-500/20", 
    icon: "bg-gradient-to-br from-emerald-500 to-green-600",
    border: "border-emerald-500/20"
  },
  animation: { 
    bg: "from-fuchsia-500/20 via-fuchsia-500/10 to-purple-500/20", 
    icon: "bg-gradient-to-br from-fuchsia-500 to-purple-600",
    border: "border-fuchsia-500/20"
  },
  trending: { 
    bg: "from-rose-500/20 via-rose-500/10 to-pink-500/20", 
    icon: "bg-gradient-to-br from-rose-500 to-pink-600",
    border: "border-rose-500/20"
  },
  new_releases: { 
    bg: "from-amber-500/20 via-amber-500/10 to-orange-500/20", 
    icon: "bg-gradient-to-br from-amber-500 to-orange-600",
    border: "border-amber-500/20"
  },
  recently_added: { 
    bg: "from-amber-500/20 via-amber-500/10 to-orange-500/20", 
    icon: "bg-gradient-to-br from-amber-500 to-orange-600",
    border: "border-amber-500/20"
  },
  genre: { 
    bg: "from-violet-500/20 via-violet-500/10 to-indigo-500/20", 
    icon: "bg-gradient-to-br from-violet-500 to-indigo-600",
    border: "border-violet-500/20"
  },
  curated: { 
    bg: "from-pink-500/20 via-pink-500/10 to-rose-500/20", 
    icon: "bg-gradient-to-br from-pink-500 to-rose-600",
    border: "border-pink-500/20"
  },
  free_content: { 
    bg: "from-green-500/20 via-green-500/10 to-emerald-500/20", 
    icon: "bg-gradient-to-br from-green-500 to-emerald-600",
    border: "border-green-500/20"
  },
  youtube: { 
    bg: "from-red-500/20 via-red-500/10 to-orange-500/20", 
    icon: "bg-gradient-to-br from-red-500 to-orange-600",
    border: "border-red-500/20"
  },
  default: { 
    bg: "from-slate-500/20 via-slate-500/10 to-gray-500/20", 
    icon: "bg-gradient-to-br from-slate-500 to-gray-600",
    border: "border-slate-500/20"
  },
};

const SectionHeader = ({ 
  icon: Icon, 
  title, 
  color,
  onSeeAll
}: { 
  icon: typeof Film; 
  title: string; 
  color: string;
  onSeeAll?: () => void;
}) => (
  <div className="flex items-center justify-between px-5 mb-4">
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="h-4 w-4 text-white" strokeWidth={2} />
      </div>
      <h2 className="text-[15px] font-semibold text-white tracking-[-0.02em]">{title}</h2>
    </div>
    {onSeeAll && (
      <button 
        onClick={onSeeAll}
        className="flex items-center gap-1 text-xs text-white/60 active:scale-95 transition-transform"
      >
        <span>See All</span>
        <ChevronRight className="h-3 w-3" />
      </button>
    )}
  </div>
);

export const KidsDynamicSections = ({ allContent, onPlay, onDetails, onPlayVideo }: KidsDynamicSectionsProps) => {
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
      releaseDate: item.release_date,
      createdAt: item.created_at,
      contentRating: item.content_rating,
      age_limit: item.age_limit,
    }));

  // Filter content for kids safety
  const filterForKids = (items: Content[]): Content[] => {
    return items.filter(item => {
      return isKidsContentAllowed(item as any);
    });
  };

  // Get content for a section
  const getRawSectionContent = (section: any): Content[] => {
    const movies = allContent.filter(c => c.contentType === "movie");
    const series = allContent.filter(c => c.contentType === "series");
    
    if (section.section_type === "curated") {
      const curatedItems = sectionContentData
        .filter((sc: any) => sc.section_id === section.id && sc.content)
        .map((sc: any) => transformContent([sc.content])[0]);
      return filterForKids(curatedItems).slice(0, section.max_items || 15);
    }
    
    if (section.section_type === "genre" && section.genre) {
      return filterForKids(
        allContent.filter(c => 
          c.genre?.toLowerCase().includes(section.genre.name.toLowerCase())
        )
      ).sort((a, b) => (b.year || 0) - (a.year || 0))
       .slice(0, section.max_items || 15);
    }
    
    if (section.section_type === "movie" || section.content_type_filter === "movie") {
      return filterForKids(movies)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, section.max_items || 15);
    }
    
    if (section.section_type === "series" || section.content_type_filter === "series") {
      return filterForKids(series)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, section.max_items || 15);
    }
    
    if (section.section_type === "recently_added" || section.section_type === "new_releases") {
      return filterForKids(allContent)
        .sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, section.max_items || 15);
    }

    // Free content section - only show non-premium content
    if (section.section_type === "free_content") {
      // Check if curated
      if (section.is_curated) {
        const curatedFree = sectionContentData
          .filter((sc: any) => sc.section_id === section.id && sc.content && !sc.content.is_premium)
          .map((sc: any) => transformContent([sc.content])[0]);
        return filterForKids(curatedFree).slice(0, section.max_items || 15);
      }
      // Filter for non-premium (free) content only
      let freeFiltered = allContent.filter((c) => !c.isPremium);
      if (section.content_type_filter === "movie") {
        freeFiltered = freeFiltered.filter((c) => c.contentType === "movie");
      } else if (section.content_type_filter === "series") {
        freeFiltered = freeFiltered.filter((c) => c.contentType === "series");
      }
      return filterForKids(freeFiltered)
        .sort((a, b) => (b.year || 0) - (a.year || 0))
        .slice(0, section.max_items || 15);
    }

    // YouTube section - handled separately in render
    if (section.section_type === "youtube") {
      return []; // Return empty, YouTube is rendered separately
    }
    
    // Default: return all filtered content sorted by year
    let filtered = [...allContent];
    if (section.content_type_filter === "movie") {
      filtered = movies;
    } else if (section.content_type_filter === "series") {
      filtered = series;
    }
    
    return filterForKids(filtered)
      .sort((a, b) => (b.year || 0) - (a.year || 0))
      .slice(0, section.max_items || 15);
  };

  const getSectionContent = (section: any): Content[] => {
    const filtered = applyAdminFilters(getRawSectionContent(section), section);
    return orderHomepageContent(filtered, section.section_type).slice(0, section.max_items || 15);
  };

  // Map card size from admin settings - respect all three sizes
  const getCardVariant = (section: any): "default" | "large" | "featured" | "full" => {
    // If cardStyle is "full", return full variant
    if (section.card_style === "full") return "full";
    const size = section.card_size || "md";
    if (size === "lg") return "large";
    if (size === "md") return "default";
    if (size === "sm") return "default"; // sm uses default variant but smaller in CSS
    return "default";
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

        // Handle YouTube section separately (Live Channels)
        if (sectionType === "youtube") {
          if (!onPlayVideo) return null;
          return (
            <motion.section 
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.4, ease: "easeOut", delay: sectionIndex * 0.05 }}
              className={`bg-gradient-to-br ${colors.bg} rounded-xl mx-3 py-4 border ${colors.border}`}
            >
              <SectionHeader 
                icon={Icon} 
                title={section.title} 
                color={colors.icon}
              />
              <KidsMobileYouTubeRow onPlayVideo={onPlayVideo} />
            </motion.section>
          );
        }

        // Handle continue_watching section - skip, handled elsewhere
        if (sectionType === "continue_watching" || sectionType === "my_list") {
          return null;
        }

        const sectionContent = getSectionContent(section);
        if (sectionContent.length === 0) return null;

        const cardVariant = getCardVariant(section);
        const cardSize = (section.card_size as "sm" | "md" | "lg") || "md";
        const cardStyle = (section.card_style as "poster" | "backdrop" | "wide" | "square" | "minimal" | "full") || "poster";

        // Determine appropriate "See All" destination
        const seeAllRoute = sectionType === "free_content" 
          ? "/free-content" 
          : "/genres";

        return (
          <motion.section 
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.4, ease: "easeOut", delay: sectionIndex * 0.05 }}
            className={`bg-gradient-to-br ${colors.bg} rounded-xl mx-3 py-4 border ${colors.border}`}
          >
            <SectionHeader 
              icon={Icon} 
              title={section.title} 
              color={colors.icon}
              onSeeAll={() => navigate(seeAllRoute)} 
            />
            <div className="flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
              {sectionContent.map((item, index) => {
                // Map admin card size to width classes for consistent sizing
                const sizeWidthClasses = cardStyle === "full" 
                  ? { sm: "w-28", md: "w-32", lg: "w-40" }
                  : { sm: "w-24", md: "w-28", lg: "w-36" };
                
                return (
                  <div 
                    key={item.id} 
                    className={`flex-shrink-0 ${sizeWidthClasses[cardSize]}`}
                  >
                    <KidsMobileContentCard
                      content={item}
                      onPlay={onPlay}
                      onDetails={onDetails}
                      index={index}
                      variant={cardVariant}
                      cardSize={cardSize}
                      cardStyle={cardStyle}
                      hasNewEpisode={tvShowUpdates[item.id]?.hasNewEpisode}
                      hasNewSeason={tvShowUpdates[item.id]?.hasNewSeason}
                    />
                  </div>
                );
              })}
            </div>
          </motion.section>
        );
      })}
    </>
  );
};