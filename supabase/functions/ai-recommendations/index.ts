import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a movie and TV show recommendation expert. Always respond with valid JSON arrays only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later.", recommendations: [] }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required", recommendations: [] }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parse the JSON response
    let recommendations = [];
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      recommendations = [];
    }

    return new Response(
      JSON.stringify({ recommendations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("ai-recommendations error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, recommendations: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
