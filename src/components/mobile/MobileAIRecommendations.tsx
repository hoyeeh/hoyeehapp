import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useProfile, useContent, useWatchlist } from "@/hooks/useDatabase";
import { useAIPickReasons } from "@/hooks/useAIPickReasons";
import { Content } from "@/types";
import { Loader2, Sparkles, RefreshCw, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileAIRecommendationsProps {
  onDetails: (content: Content) => void;
  maxItems?: number;
}

interface AIRecommendation {
  title: string;
  genre: string;
  reason: string;
  type: "movie" | "series";
}

export function MobileAIRecommendations({ onDetails, maxItems = 12 }: MobileAIRecommendationsProps) {
  const { currentProfile } = useProfileContext();
  const { data: profile } = useProfile();
  const { data: allContent = [] } = useContent();
  const { data: watchlistIds = [] } = useWatchlist();
  const { getReason } = useAIPickReasons();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["mobile-ai-recommendations", currentProfile?.id],
    queryFn: async () => {
      // Get watch history with genres and content types
      const { data: watchHistory } = await supabase
        .from("watch_history")
        .select("content:content_id(genre, content_type, title)")
        .order("last_watched", { ascending: false })
        .limit(30);

      const watchedItems = watchHistory?.map((item: any) => ({
        genre: item.content?.genre,
        contentType: item.content?.content_type,
        title: item.content?.title,
      })).filter((item: any) => item.genre) || [];

      // Extract unique genres from watch history
      const genres = [...new Set(watchedItems.map((item: any) => item.genre))];
      
      // Get content types user watches
      const movieCount = watchedItems.filter((item: any) => item.content_type === 'movie').length;
      const seriesCount = watchedItems.filter((item: any) => item.content_type === 'series').length;
      const preferredType = movieCount > seriesCount ? 'movie' : seriesCount > movieCount ? 'series' : 'both';

      // Get profile preferences if available
      let preferences: any[] = [];
      if (currentProfile?.id) {
        const { data: prefs } = await supabase
          .from("profile_watch_preferences")
          .select("*")
          .eq("profile_id", currentProfile.id);
        preferences = prefs || [];
      }

      const { data: result, error } = await supabase.functions.invoke(
        "ai-recommendations",
        {
          body: {
            watchHistory: genres,
            watchedTitles: watchedItems.map((item: any) => item.title).slice(0, 10),
            preferredContentType: preferredType,
            preferences,
            isKids: currentProfile?.is_kids || false,
          },
        }
      );

      if (error) throw error;
      return result?.recommendations || [];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!currentProfile,
  });

  // Match AI recommendations with actual content in database
  const matchedContent = (data as AIRecommendation[] || [])
    .map((rec) => {
      // Find content that matches the recommendation title and type
      const match = allContent.find(
        (c) => (c.title.toLowerCase().includes(rec.title.toLowerCase()) ||
               rec.title.toLowerCase().includes(c.title.toLowerCase())) &&
               (rec.type === 'movie' ? c.contentType === 'movie' : c.contentType === 'series' || true)
      );
      return match ? { content: match, reason: rec.reason } : null;
    })
    .filter(Boolean) as { content: Content; reason: string }[];

  // If we don't have enough matches, supplement with content from user's preferred genres
  const recommendedContent = useMemo(() => {
    if (matchedContent.length >= 5) {
      return matchedContent.slice(0, maxItems);
    }
    
    const existingIds = new Set(matchedContent.map(m => m.content.id));
    const additionalContent = allContent
      .filter(c => !watchlistIds.includes(c.id) && !existingIds.has(c.id))
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, maxItems - matchedContent.length)
      .map(c => ({ content: c, reason: "Recommended for you" }));
    
    return [...matchedContent, ...additionalContent].slice(0, maxItems);
  }, [matchedContent, allContent, watchlistIds, maxItems]);

  const displayName = currentProfile?.name || profile?.display_name || "You";

  if (!currentProfile) return null;
  if (recommendedContent.length === 0 && !isLoading) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-semibold">For {displayName}</h2>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="p-1.5 rounded-full hover:bg-secondary active:scale-95 transition-all"
        >
          <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isRefetching && "animate-spin")} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 px-4">
          <Loader2 className="h-6 w-6 animate-spin text-brand mr-2" />
          <span className="text-sm text-muted-foreground">Finding picks...</span>
        </div>
      ) : (
        <div
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {recommendedContent.map(({ content, reason }) => (
            <div
              key={content.id}
              className="flex-shrink-0 w-64 active:scale-95 transition-transform"
              onClick={() => onDetails(content)}
            >
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-secondary shadow-lg ring-1 ring-border/10">
                <img
                  src={content.thumbnailUrl}
                  alt={content.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
                
                {/* AI Badge */}
                <div className="absolute top-2 right-2 bg-brand/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span className="text-[10px] font-medium">AI Pick</span>
                </div>

                {content.isPremium && (
                  <div className="absolute top-2 left-2 bg-brand px-2 py-0.5 rounded text-[10px] font-semibold text-primary-foreground">
                    PRO
                  </div>
                )}
                
                {/* Title overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="font-semibold text-sm line-clamp-2 text-foreground">{content.title}</h3>
                  {content.genre && (
                    <p className="text-xs text-muted-foreground mt-0.5">{content.genre.split(',')[0]}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
