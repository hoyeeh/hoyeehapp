import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TMDB_API_KEY = "6f3977dc8470a256a7350cb703e2c366";
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
    const { tmdb_id, type = 'movie' } = await req.json();
    
    if (!tmdb_id) {
      return new Response(
        JSON.stringify({ error: 'TMDB ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching TMDB details for: ${tmdb_id}, type: ${type}`);

    const endpoint = type === 'series' ? 'tv' : 'movie';
    
    // Fetch main details and credits in parallel
    const [detailsRes, creditsRes, similarRes] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdb_id}?api_key=${TMDB_API_KEY}`),
      fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdb_id}/credits?api_key=${TMDB_API_KEY}`),
      fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdb_id}/similar?api_key=${TMDB_API_KEY}`)
    ]);

    if (!detailsRes.ok) {
      throw new Error(`TMDB API error: ${detailsRes.status}`);
    }

    const details = await detailsRes.json();
    const credits = creditsRes.ok ? await creditsRes.json() : { cast: [], crew: [] };
    const similar = similarRes.ok ? await similarRes.json() : { results: [] };

    // Get director for movies
    const director = credits.crew?.find((c: any) => c.job === 'Director');
    
    // Get top cast (first 10)
    const cast = (credits.cast || []).slice(0, 10).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profile_path: c.profile_path ? `${TMDB_IMAGE_BASE}${c.profile_path}` : null,
    }));

    // Get similar content (first 6)
    const recommendations = (similar.results || []).slice(0, 6).map((r: any) => ({
      tmdb_id: r.id,
      title: type === 'series' ? r.name : r.title,
      thumbnail_url: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : null,
      year: (type === 'series' ? r.first_air_date : r.release_date)?.split('-')[0],
      rating: r.vote_average?.toFixed(1),
    }));

    const enrichedData = {
      tmdb_id: details.id,
      title: type === 'series' ? details.name : details.title,
      description: details.overview,
      thumbnail_url: details.poster_path ? `${TMDB_IMAGE_BASE}${details.poster_path}` : null,
      backdrop_url: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
      year: (type === 'series' ? details.first_air_date : details.release_date)?.split('-')[0],
      rating: details.vote_average?.toFixed(1),
      duration: type === 'series' ? details.episode_run_time?.[0] || 0 : details.runtime || 0,
      genres: details.genres?.map((g: any) => g.name) || [],
      director: director?.name || null,
      cast,
      recommendations,
      tagline: details.tagline,
      status: details.status,
      language: details.original_language,
      vote_count: details.vote_count,
    };

    console.log(`Found details for: ${enrichedData.title}`);
    
    return new Response(
      JSON.stringify(enrichedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in tmdb-details function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
