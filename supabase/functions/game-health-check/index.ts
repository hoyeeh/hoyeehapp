import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GameHealthResult {
  id: string;
  title: string;
  embed_url: string;
  previous_status: string | null;
  new_status: string;
  can_embed: boolean;
  error?: string;
}

async function checkGameHealth(game: { id: string; title: string; embed_url: string; embed_type: string; health_status: string | null }): Promise<GameHealthResult> {
  const result: GameHealthResult = {
    id: game.id,
    title: game.title,
    embed_url: game.embed_url,
    previous_status: game.health_status,
    new_status: "healthy",
    can_embed: game.embed_type === "iframe",
  };

  try {
    // Make a HEAD request to check if URL is accessible
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(game.embed_url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "HoyeehGameHealthChecker/1.0",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      result.new_status = "broken";
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      return result;
    }

    // Check X-Frame-Options header
    const xFrameOptions = response.headers.get("x-frame-options");
    const csp = response.headers.get("content-security-policy");

    // Determine if embedding is blocked
    const embedBlocked = 
      xFrameOptions?.toLowerCase() === "deny" ||
      xFrameOptions?.toLowerCase() === "sameorigin" ||
      csp?.includes("frame-ancestors 'none'") ||
      csp?.includes("frame-ancestors 'self'");

    if (embedBlocked && game.embed_type === "iframe") {
      result.can_embed = false;
      // Don't mark as broken, just note that it can't be embedded
      console.log(`Game "${game.title}" blocks iframe embedding`);
    }

    result.new_status = "healthy";
  } catch (err) {
    const error = err as Error;
    if (error.name === "AbortError") {
      result.new_status = "timeout";
      result.error = "Request timed out after 10 seconds";
    } else {
      result.new_status = "broken";
      result.error = error.message;
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active games
    const { data: games, error: fetchError } = await supabase
      .from("playable_games")
      .select("id, title, embed_url, embed_type, health_status")
      .eq("is_active", true);

    if (fetchError) {
      throw new Error(`Failed to fetch games: ${fetchError.message}`);
    }

    if (!games || games.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active games to check", checked: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking health of ${games.length} games...`);

    // Check health of all games in parallel (with concurrency limit)
    const results: GameHealthResult[] = [];
    const batchSize = 5; // Process 5 games at a time

    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(checkGameHealth));
      results.push(...batchResults);
    }

    // Update games with changed health status
    const updates: { id: string; health_status: string }[] = [];
    const statusChanges: { title: string; from: string | null; to: string }[] = [];

    for (const result of results) {
      if (result.previous_status !== result.new_status) {
        updates.push({ id: result.id, health_status: result.new_status });
        statusChanges.push({
          title: result.title,
          from: result.previous_status,
          to: result.new_status,
        });
      }
    }

    // Batch update health statuses and last_health_check timestamp
    const now = new Date().toISOString();
    
    // Update all checked games with new timestamp
    for (const result of results) {
      const updateData: { health_status?: string; last_health_check: string } = {
        last_health_check: now,
      };
      
      // Only update health_status if it changed
      if (result.previous_status !== result.new_status) {
        updateData.health_status = result.new_status;
      }
      
      const { error: updateError } = await supabase
        .from("playable_games")
        .update(updateData)
        .eq("id", result.id);

      if (updateError) {
        console.error(`Failed to update game ${result.id}:`, updateError);
      }
    }

    const summary = {
      checked: games.length,
      healthy: results.filter(r => r.new_status === "healthy").length,
      broken: results.filter(r => r.new_status === "broken").length,
      timeout: results.filter(r => r.new_status === "timeout").length,
      statusChanges,
      timestamp: new Date().toISOString(),
    };

    console.log("Health check complete:", JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const error = err as Error;
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
