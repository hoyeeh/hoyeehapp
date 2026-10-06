import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AIPickReason {
  /** Short, user-facing explanation, e.g. "Trending #4 worldwide this week". */
  label: string;
  /** Where the signal came from. */
  source: "tmdb_trending" | "watch_history" | "catalog";
  /** 0-100 confidence score for the suggestion. */
  confidence: number;
}

interface TrendRow {
  content_id: string | null;
  title: string;
  trend_rank: number;
  trend_window: string;
  popularity: number | null;
  vote_average: number | null;
}

/**
 * Loads real-world trend signals (TMDB) for titles we own, so personalized rows can
 * explain *why* a card was suggested with a source + confidence score.
 */
export function useAIPickReasons() {
  const { data: trends = [] } = useQuery({
    queryKey: ["ai-pick-trends"],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_trends")
        .select("content_id, title, trend_rank, trend_window, popularity, vote_average")
        .eq("is_owned", true)
        .order("trend_rank", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as TrendRow[];
    },
  });

  const byContentId = new Map<string, TrendRow>();
  for (const t of trends) {
    if (!t.content_id) continue;
    const existing = byContentId.get(t.content_id);
    if (!existing || t.trend_rank < existing.trend_rank) byContentId.set(t.content_id, t);
  }

  /**
   * Build the "why this was suggested" line for a card.
   * `aiReason` is the recommendation rationale used when there is no trend signal.
   */
  const getReason = (contentId: string, aiReason?: string): AIPickReason | null => {
    const trend = byContentId.get(contentId);

    if (trend) {
      const window = trend.trend_window === "day" ? "today" : "this week";
      // Confidence: top ranks are strongest, nudged up by audience score.
      const rankScore = Math.max(0, 100 - (trend.trend_rank - 1) * 2.5);
      const voteScore = ((Number(trend.vote_average) || 0) / 10) * 100;
      const confidence = Math.round(Math.min(99, rankScore * 0.7 + voteScore * 0.3));
      return {
        label: `Trending #${trend.trend_rank} worldwide ${window}`,
        source: "tmdb_trending",
        confidence,
      };
    }

    if (aiReason && aiReason !== "Recommended for you") {
      return { label: aiReason, source: "watch_history", confidence: 78 };
    }

    return { label: "Popular in your library", source: "catalog", confidence: 62 };
  };

  return { getReason, hasTrends: byContentId.size > 0 };
}
