import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, parseJSONFromAI } from "../_shared/ai-client.ts";

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
    // Get user from authorization header for rate limiting
    const authHeader = req.headers.get("authorization");
    let userId = "anonymous";
    
    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
      }
    }

    // Check rate limit
    if (!checkRateLimit(userId)) {
      console.log(`Rate limit exceeded for user: ${userId}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a minute before requesting more recommendations.", recommendations: [] }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { watchHistory, preferences, isKids } = await req.json();

    // Build the prompt based on user data
    const prompt = `Based on the user's watch history and preferences, suggest 5 movie or TV show recommendations.

User's Watch History (genres they've watched):
${watchHistory?.length > 0 ? watchHistory.join(", ") : "No watch history yet"}

User's Preferred Genres:
${preferences?.length > 0 ? preferences.map((p: any) => p.genre).join(", ") : "No specific preferences"}

${isKids ? "IMPORTANT: This is a KIDS profile. Only suggest family-friendly content rated G or PG. No violence, adult themes, or scary content." : ""}

Return a JSON array with exactly 5 recommendations. Each recommendation should have:
- title: The movie/show title
- genre: Primary genre
- reason: Brief explanation why this would be good (1 sentence)
- type: Either "movie" or "series"

Only return the JSON array, no other text.`;

    const messages = [
      { role: "system" as const, content: "You are a movie and TV show recommendation expert. Always respond with valid JSON arrays only." },
      { role: "user" as const, content: prompt },
    ];

    try {
      const { content, provider } = await callAI(messages);
      console.log(`AI recommendations generated using: ${provider}`);
      
      // Parse the JSON response
      let recommendations = [];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          recommendations = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Failed to parse AI response:", e);
        recommendations = [];
      }

      return new Response(
        JSON.stringify({ recommendations, provider }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (aiError) {
      console.error("AI call failed:", aiError);
      
      // Check if it's a rate limit or payment error
      if (aiError instanceof Error) {
        if (aiError.message.includes("429")) {
          return new Response(
            JSON.stringify({ error: "Rate limits exceeded, please try again later.", recommendations: [] }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (aiError.message.includes("402")) {
          return new Response(
            JSON.stringify({ error: "Payment required", recommendations: [] }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      throw aiError;
    }
  } catch (error: unknown) {
    console.error("ai-recommendations error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, recommendations: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
