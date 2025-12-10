import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TMDB_API_KEY) {
      console.error('TMDB_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'TMDB API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tmdb_id, season_number } = await req.json();
    
    if (!tmdb_id) {
      return new Response(
        JSON.stringify({ error: 'TMDB ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching TMDB seasons for TV show ID: ${tmdb_id}`);

    // If season_number is provided, fetch specific season with episodes
    if (season_number !== undefined) {
      const seasonRes = await fetch(
        `${TMDB_BASE_URL}/tv/${tmdb_id}/season/${season_number}?api_key=${TMDB_API_KEY}`
      );

      if (!seasonRes.ok) {
        throw new Error(`TMDB API error: ${seasonRes.status}`);
      }

      const seasonData = await seasonRes.json();
      
      const episodes = seasonData.episodes?.map((ep: any) => ({
        episode_number: ep.episode_number,
        title: ep.name,
        description: ep.overview,
        thumbnail_url: ep.still_path ? `${TMDB_IMAGE_BASE}${ep.still_path}` : null,
        duration: ep.runtime || 0,
        air_date: ep.air_date,
        rating: ep.vote_average?.toFixed(1),
      })) || [];

      console.log(`Found ${episodes.length} episodes for season ${season_number}`);

      return new Response(
        JSON.stringify({
          season_number: seasonData.season_number,
          name: seasonData.name,
          overview: seasonData.overview,
          poster_path: seasonData.poster_path ? `${TMDB_IMAGE_BASE}${seasonData.poster_path}` : null,
          air_date: seasonData.air_date,
          episodes,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all seasons for the TV show
    const showRes = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdb_id}?api_key=${TMDB_API_KEY}`
    );

    if (!showRes.ok) {
      throw new Error(`TMDB API error: ${showRes.status}`);
    }

    const showData = await showRes.json();
    
    const seasons = showData.seasons?.filter((s: any) => s.season_number > 0).map((s: any) => ({
      season_number: s.season_number,
      name: s.name,
      overview: s.overview,
      poster_path: s.poster_path ? `${TMDB_IMAGE_BASE}${s.poster_path}` : null,
      episode_count: s.episode_count,
      air_date: s.air_date,
    })) || [];

    console.log(`Found ${seasons.length} seasons for: ${showData.name}`);

    return new Response(
      JSON.stringify({
        tmdb_id: showData.id,
        title: showData.name,
        number_of_seasons: showData.number_of_seasons,
        number_of_episodes: showData.number_of_episodes,
        seasons,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in tmdb-seasons function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
