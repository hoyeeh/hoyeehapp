import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TMDB_API_KEY) {
      throw new Error("TMDB_API_KEY not configured");
    }

    const { query, type = "movie" } = await req.json();

    if (!query) {
      throw new Error("Search query is required");
    }

    console.log(`Searching TMDB for: ${query}, type: ${type}`);

    // Search for content
    const endpoint = type === "movie" ? "search/movie" : "search/tv";
    const searchRes = await fetch(
      `${TMDB_BASE_URL}/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`
    );

    if (!searchRes.ok) {
      throw new Error(`TMDB search failed: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();
    
    if (!searchData.results || searchData.results.length === 0) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process top 10 results with details
    const results = await Promise.all(
      searchData.results.slice(0, 10).map(async (item: any) => {
        const tmdbId = item.id;
        const detailEndpoint = type === "movie" ? `movie/${tmdbId}` : `tv/${tmdbId}`;
        
        // Fetch details and videos in parallel
        const [detailsRes, videosRes] = await Promise.all([
          fetch(`${TMDB_BASE_URL}/${detailEndpoint}?api_key=${TMDB_API_KEY}&language=en-US`),
          fetch(`${TMDB_BASE_URL}/${detailEndpoint}/videos?api_key=${TMDB_API_KEY}&language=en-US`)
        ]);

        let details = null;
        let trailerUrl = null;

        if (detailsRes.ok) {
          details = await detailsRes.json();
        }

        if (videosRes.ok) {
          const videosData = await videosRes.json();
          // Find official YouTube trailer
          const trailer = videosData.results?.find(
            (v: any) => v.type === "Trailer" && v.site === "YouTube" && v.official
          ) || videosData.results?.find(
            (v: any) => v.type === "Trailer" && v.site === "YouTube"
          ) || videosData.results?.find(
            (v: any) => v.site === "YouTube"
          );
          
          if (trailer) {
            trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
          }
        }

        // Get first genre
        const genre = details?.genres?.[0]?.name || 
          (type === "movie" ? item.genre_ids?.[0] : item.genre_ids?.[0]) || "";

        return {
          tmdb_id: tmdbId,
          title: type === "movie" ? item.title : item.name,
          description: item.overview || "",
          content_type: type === "movie" ? "movie" : "series",
          genre: typeof genre === "string" ? genre : "",
          thumbnail_url: item.poster_path 
            ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}` 
            : null,
          backdrop_url: item.backdrop_path 
            ? `${TMDB_IMAGE_BASE}/original${item.backdrop_path}` 
            : null,
          trailer_url: trailerUrl,
          release_date: type === "movie" ? item.release_date : item.first_air_date,
          rating: item.vote_average?.toFixed(1) || null,
          popularity: item.popularity || 0,
        };
      })
    );

    console.log(`Found ${results.length} results`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in tmdb-coming-soon-search:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
