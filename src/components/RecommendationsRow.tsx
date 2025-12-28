import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Content } from "@/types";
import { ChevronLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ContentCard } from "./ContentCard";

interface RecommendationsRowProps {
  onPlay: (content: Content) => void;
  onToggleList: (content: Content) => void;
  onDetails: (content: Content) => void;
  userList: string[];
}

export const RecommendationsRow = ({
  onPlay,
  onToggleList,
  onDetails,
  userList,
}: RecommendationsRowProps) => {
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recommendations", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.functions.invoke("get-recommendations", {
        body: { userId: user.id },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (!user || isLoading) {
    if (isLoading) {
      return (
        <section className="mb-8">
          <h2 className="font-display text-xl md:text-2xl mb-4 px-4 md:px-12 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand" />
            Recommended For You
          </h2>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        </section>
      );
    }
    return null;
  }

  const recommendations = data?.recommendations || [];

  if (recommendations.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="px-4 md:px-12 mb-4">
        <h2 className="font-display text-xl md:text-2xl flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand" />
          Recommended For You
        </h2>
        {data?.preferredGenres?.length > 0 && (
          <div className="flex gap-2 mt-2">
            {data.preferredGenres.slice(0, 3).map((genre: string) => (
              <span
                key={genre}
                className="px-2 py-0.5 text-xs rounded-full bg-brand/20 text-brand"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative group/row">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-8 z-10 w-12 bg-gradient-to-r from-background to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>

        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-8 z-10 w-12 bg-gradient-to-l from-background to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <ChevronRight className="h-8 w-8" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {recommendations.map((item: Content) => (
            <ContentCard
              key={item.id}
              content={item}
              onPlay={onPlay}
              onToggleList={onToggleList}
              onDetails={onDetails}
              isInList={userList.includes(item.id)}
              cardStyle="wide"
            />
          ))}
        </div>
      </div>
    </section>
  );
};
