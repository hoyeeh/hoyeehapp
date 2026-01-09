import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TMDB_API_KEY) {
      throw new Error("TMDB_API_KEY not configured");
    }

    const { query, tmdb_id, type = "movie" } = await req.json();

    // If searching by query
    if (query) {
      const searchType = type === "series" ? "tv" : "movie";
      const searchUrl = `${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`;
      
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (!searchData.results || searchData.results.length === 0) {
        return new Response(
          JSON.stringify({ results: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Format results with image URLs
      const results = searchData.results.slice(0, 10).map((item: any) => ({
        tmdb_id: item.id,
        title: item.title || item.name,
        content_type: type,
        desktop_image_url: item.backdrop_path 
          ? `${TMDB_IMAGE_BASE}/w1920_and_h800_multi_faces${item.backdrop_path}`
          : null,
        mobile_image_url: item.poster_path 
          ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}`
          : null,
        year: (item.release_date || item.first_air_date || "").split("-")[0],
      }));

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If fetching by TMDB ID
    if (tmdb_id) {
      const detailType = type === "series" ? "tv" : "movie";
      const detailUrl = `${TMDB_BASE_URL}/${detailType}/${tmdb_id}?api_key=${TMDB_API_KEY}`;
      
      const detailResponse = await fetch(detailUrl);
      const detailData = await detailResponse.json();

      if (detailData.success === false) {
        throw new Error(detailData.status_message || "Failed to fetch TMDB details");
      }

      const result = {
        tmdb_id: detailData.id,
        title: detailData.title || detailData.name,
        content_type: type,
        desktop_image_url: detailData.backdrop_path 
          ? `${TMDB_IMAGE_BASE}/w1920_and_h800_multi_faces${detailData.backdrop_path}`
          : null,
        mobile_image_url: detailData.poster_path 
          ? `${TMDB_IMAGE_BASE}/w500${detailData.poster_path}`
          : null,
        year: (detailData.release_date || detailData.first_air_date || "").split("-")[0],
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Either 'query' or 'tmdb_id' is required");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("TMDB Profile Background Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
