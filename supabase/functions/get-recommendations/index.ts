import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter (10 requests per minute per user)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check rate limit
    if (!checkRateLimit(userId)) {
      console.log(`Rate limit exceeded for user: ${userId}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a minute before requesting more recommendations." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user's watch history
    const { data: watchHistory, error: historyError } = await supabase
      .from("watch_history")
      .select(`
        content_id,
        progress,
        content:content_id (
          id, title, genre, content_type, year, rating
        )
      `)
      .eq("user_id", userId)
      .order("last_watched", { ascending: false })
      .limit(20);

    if (historyError) {
      console.error("Watch history error:", historyError);
    }

    // Fetch user's reviews
    const { data: userReviews, error: reviewsError } = await supabase
      .from("reviews")
      .select(`
        rating,
        content:content_id (
          id, title, genre, content_type
        )
      `)
      .eq("user_id", userId);

    if (reviewsError) {
      console.error("Reviews error:", reviewsError);
    }

    // Fetch all available content
    const { data: allContent, error: contentError } = await supabase
      .from("content")
      .select("id, title, description, thumbnail_url, video_url, genre, content_type, is_premium, duration, year, rating, view_count")
      .limit(100);

    if (contentError) {
      console.error("Content error:", contentError);
      throw contentError;
    }

    // Extract watched content IDs
    const watchedIds = new Set(watchHistory?.map((w: any) => w.content_id) || []);
    const reviewedIds = new Set(userReviews?.map((r: any) => r.content?.id) || []);

    // Extract preferred genres from watch history
    const genreCounts: Record<string, number> = {};
    watchHistory?.forEach((item: any) => {
      if (item.content?.genre) {
        const genres = item.content.genre.split(",").map((g: string) => g.trim());
        genres.forEach((g: string) => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      }
    });

    // Add weight from highly rated reviews
    userReviews?.forEach((review: any) => {
      if (review.rating >= 4 && review.content?.genre) {
        const genres = review.content.genre.split(",").map((g: string) => g.trim());
        genres.forEach((g: string) => {
          genreCounts[g] = (genreCounts[g] || 0) + (review.rating - 2);
        });
      }
    });

    // Sort genres by preference
    const preferredGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre);

    // Filter unwatched content
    const unwatchedContent = allContent?.filter((c: any) => !watchedIds.has(c.id)) || [];

    // Score content based on preferences
    const scoredContent = unwatchedContent.map((content: any) => {
      let score = 0;
      
      // Genre match scoring
      if (content.genre) {
        const contentGenres = content.genre.split(",").map((g: string) => g.trim());
        contentGenres.forEach((g: string) => {
          const genreIndex = preferredGenres.indexOf(g);
          if (genreIndex !== -1) {
            score += (preferredGenres.length - genreIndex) * 10;
          }
        });
      }

      // Boost popular content
      score += Math.log10((content.view_count || 1) + 1) * 2;

      // Boost highly rated content
      if (content.rating) {
        const ratingMatch = content.rating.match(/(\d+\.?\d*)/);
        if (ratingMatch) {
          score += parseFloat(ratingMatch[1]) * 5;
        }
      }

      return { ...content, score };
    });

    // Sort by score and return top recommendations
    const recommendations = scoredContent
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 15)
      .map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        thumbnailUrl: c.thumbnail_url,
        videoUrl: c.video_url,
        genre: c.genre,
        contentType: c.content_type,
        isPremium: c.is_premium,
        duration: c.duration,
        year: c.year,
        rating: c.rating,
      }));

    // If we have recommendations, use AI to generate a personalized message
    let aiMessage = "";
    if (preferredGenres.length > 0) {
      try {
        const messages = [
          {
            role: "system" as const,
            content: "You are a friendly movie recommendation assistant. Generate a very brief (1-2 sentences) personalized message about why these recommendations were selected. Be warm and concise."
          },
          {
            role: "user" as const,
            content: `User's favorite genres are: ${preferredGenres.join(", ")}. They've watched ${watchHistory?.length || 0} titles. Generate a brief personalized recommendation intro.`
          }
        ];

        const { content, provider } = await callAI(messages);
        console.log(`Personalized message generated using: ${provider}`);
        aiMessage = content;
      } catch (aiError) {
        console.error("AI message generation failed:", aiError);
      }
    }

    return new Response(
      JSON.stringify({
        recommendations,
        preferredGenres,
        aiMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Recommendations error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
