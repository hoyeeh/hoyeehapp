import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
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

    const { query, type = 'movie', multi = false } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching TMDB for: ${query}, type: ${type}, multi: ${multi}`);

    const endpoint = type === 'series' ? 'search/tv' : 'search/movie';
    const response = await fetch(
      `${TMDB_BASE_URL}/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) {
      console.error(`TMDB API error: ${response.status}`);
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Return multiple results if requested
      if (multi) {
        const results = data.results.slice(0, 10).map((result: any) => ({
          tmdb_id: result.id,
          title: type === 'series' ? result.name : result.title,
          description: result.overview,
          thumbnail_url: result.poster_path ? `${TMDB_IMAGE_BASE}${result.poster_path}` : null,
          backdrop_url: result.backdrop_path ? `${TMDB_IMAGE_BASE}${result.backdrop_path}` : null,
          year: (type === 'series' ? result.first_air_date : result.release_date)?.split('-')[0],
          rating: result.vote_average?.toFixed(1),
          popularity: result.popularity,
        }));

        console.log(`Found ${results.length} results`);
        
        return new Response(
          JSON.stringify({ results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return single result (backwards compatibility)
      const result = data.results[0];
      const enrichedData = {
        tmdb_id: result.id,
        title: type === 'series' ? result.name : result.title,
        description: result.overview,
        thumbnail_url: result.poster_path ? `${TMDB_IMAGE_BASE}${result.poster_path}` : null,
        backdrop_url: result.backdrop_path ? `${TMDB_IMAGE_BASE}${result.backdrop_path}` : null,
        year: (type === 'series' ? result.first_air_date : result.release_date)?.split('-')[0],
        rating: result.vote_average?.toFixed(1),
        popularity: result.popularity,
      };

      console.log(`Found result: ${enrichedData.title}`);
      
      return new Response(
        JSON.stringify(enrichedData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'No results found', results: [] }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in tmdb-search function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
