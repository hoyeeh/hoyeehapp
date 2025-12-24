import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useProfile, useContent } from "@/hooks/useDatabase";
import { Content } from "@/types";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface AIRecommendationsRowProps {
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  userList: string[];
}

interface AIRecommendation {
  title: string;
  genre: string;
  reason: string;
  type: "movie" | "series";
}

export const AIRecommendationsRow = ({
  onPlay,
  onToggleList,
  onDetails,
  userList,
}: AIRecommendationsRowProps) => {
  const { currentProfile } = useProfileContext();
  const { data: profile } = useProfile();
  const { data: allContent = [] } = useContent();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["ai-recommendations", currentProfile?.id],
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
      return matchedContent.slice(0, 15);
    }
    
    // Get additional content based on view count and not in user's list
    const existingIds = new Set(matchedContent.map(m => m.content.id));
    const additionalContent = allContent
      .filter(c => !userList.includes(c.id) && !existingIds.has(c.id))
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 15 - matchedContent.length)
      .map(c => ({ content: c, reason: "Recommended for you" }));
    
    return [...matchedContent, ...additionalContent].slice(0, 15);
  }, [matchedContent, allContent, userList]);

  const displayName = currentProfile?.name || profile?.display_name || "You";

  if (!currentProfile) return null;
  if (recommendedContent.length === 0 && !isLoading) return null;

  return (
    <section className="px-4 md:px-12 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-brand" />
          <h2 className="font-display text-xl md:text-2xl">
            Hoyeeh Picks for {displayName}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          <span className="hidden md:inline">Refresh</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <span className="ml-2 text-muted-foreground">Finding perfect picks for you...</span>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {recommendedContent.map(({ content, reason }) => (
            <div
              key={content.id}
              className="flex-shrink-0 w-48 md:w-56 group cursor-pointer"
              onClick={() => onDetails(content)}
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary shadow-lg ring-0 group-hover:ring-2 ring-brand/50 transition-all">
                <img
                  src={content.thumbnailUrl}
                  alt={content.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                
                {/* AI Badge */}
                <div className="absolute top-2 right-2 bg-brand/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span className="text-[10px] font-semibold">HY PICKS</span>
                </div>

                {content.isPremium && (
                  <div className="absolute top-2 left-2 bg-brand px-2 py-0.5 rounded text-xs font-semibold text-primary-foreground">
                    PREMIUM
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              <div className="mt-2">
                <h3 className="font-medium text-sm truncate">{content.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {reason}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
