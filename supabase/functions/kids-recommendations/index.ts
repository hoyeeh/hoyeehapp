import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileId } = await req.json();

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: "Profile ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the kid's viewing history
    const { data: viewingHistory, error: historyError } = await supabase
      .from("kids_viewing_history")
      .select(`
        content_id,
        duration_watched_minutes,
        completed,
        content:content_id(id, title, genre, content_rating, content_type, thumbnail_url)
      `)
      .eq("profile_id", profileId)
      .order("watched_at", { ascending: false })
      .limit(50);

    if (historyError) {
      console.error("Error fetching viewing history:", historyError);
      throw historyError;
    }

    // Get the kid's profile to check age-appropriate ratings
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("name, is_kids")
      .eq("id", profileId)
      .single();

    if (profileError || !profile?.is_kids) {
      return new Response(
        JSON.stringify({ error: "Invalid kids profile" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract watched content IDs and genres
    const watchedContentIds = viewingHistory?.map((v: any) => v.content_id) || [];
    const watchedGenres: Record<string, number> = {};
    
    viewingHistory?.forEach((v: any) => {
      if (v.content?.genre) {
        const genres = v.content.genre.split(",").map((g: string) => g.trim());
        genres.forEach((genre: string) => {
          watchedGenres[genre] = (watchedGenres[genre] || 0) + (v.duration_watched_minutes || 1);
        });
      }
    });

    // Sort genres by watch time
    const topGenres = Object.entries(watchedGenres)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([genre]) => genre);

    // Kids-appropriate ratings
    const kidsRatings = ["G", "PG"];
    
    // Allowed genres for kids zone
    const allowedGenrePatterns = ["animation", "family", "animated", "cartoon"];

    // Fetch recommended content based on viewing patterns
    let recommendedContent: any[] = [];

    // If we have genre preferences, prioritize content from those genres
    if (topGenres.length > 0) {
      const { data: genreContent } = await supabase
        .from("content")
        .select("id, title, genre, content_rating, content_type, thumbnail_url, description")
        .in("content_rating", kidsRatings)
        .or("genre.ilike.%animation%,genre.ilike.%family%,genre.ilike.%animated%,genre.ilike.%cartoon%")
        .not("id", "in", `(${watchedContentIds.length > 0 ? watchedContentIds.join(",") : "00000000-0000-0000-0000-000000000000"})`)
        .limit(30);

      // Filter for allowed genres and score content based on genre match
      const scoredContent = (genreContent || [])
        .filter((content: any) => {
          if (!content.genre) return false;
          const genreLower = content.genre.toLowerCase();
          return allowedGenrePatterns.some(pattern => genreLower.includes(pattern));
        })
        .map((content: any) => {
        let score = 0;
        if (content.genre) {
          const contentGenres = content.genre.split(",").map((g: string) => g.trim());
          contentGenres.forEach((g: string) => {
            if (topGenres.includes(g)) {
              score += topGenres.indexOf(g) === 0 ? 3 : topGenres.indexOf(g) === 1 ? 2 : 1;
            }
          });
        }
        return { ...content, score };
      });

      recommendedContent = scoredContent
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);
    } else {
      // No viewing history - get popular kids content with allowed genres
      const { data: popularContent } = await supabase
        .from("content")
        .select("id, title, genre, content_rating, content_type, thumbnail_url, description, view_count")
        .in("content_rating", kidsRatings)
        .or("genre.ilike.%animation%,genre.ilike.%family%,genre.ilike.%animated%,genre.ilike.%cartoon%")
        .order("view_count", { ascending: false })
        .limit(20);

      // Filter for allowed genres
      recommendedContent = (popularContent || [])
        .filter((content: any) => {
          if (!content.genre) return false;
          const genreLower = content.genre.toLowerCase();
          return allowedGenrePatterns.some(pattern => genreLower.includes(pattern));
        })
        .slice(0, 10);
    }

    // Use AI to generate personalized recommendations if we have viewing history
    let aiRecommendation = null;
    
    if (viewingHistory && viewingHistory.length > 0) {
      const watchedTitles = viewingHistory
        .slice(0, 10)
        .map((v: any) => v.content?.title)
        .filter(Boolean);

      const prompt = `Based on a child named ${profile.name} who has recently watched: ${watchedTitles.join(", ")}. 
Their favorite genres appear to be: ${topGenres.join(", ") || "various"}.

Provide a brief, friendly recommendation message (2-3 sentences) suggesting what types of content they might enjoy next. Keep it fun and appropriate for children. Don't mention specific titles, just describe the type of content.`;

      try {
        const messages = [
          { role: "system" as const, content: "You are a friendly kids content recommendation assistant. Keep responses fun, positive, and age-appropriate." },
          { role: "user" as const, content: prompt },
        ];

        const { content, provider } = await callAI(messages);
        console.log(`Kids recommendation generated using: ${provider}`);
        aiRecommendation = content;
      } catch (aiError) {
        console.error("AI recommendation error:", aiError);
        // Continue without AI recommendation
      }
    }

    return new Response(
      JSON.stringify({
        recommendations: recommendedContent,
        topGenres,
        aiMessage: aiRecommendation,
        profileName: profile.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
