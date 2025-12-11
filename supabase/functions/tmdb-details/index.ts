import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY") || "";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map TMDB certifications to standard ratings
function mapCertification(certification: string): string {
  const certMap: Record<string, string> = {
    'G': 'G',
    'PG': 'PG',
    'PG-13': 'PG-13',
    'R': 'R',
    'NC-17': 'NC-17',
    'NR': 'NR',
    'TV-Y': 'G',
    'TV-Y7': 'G',
    'TV-G': 'G',
    'TV-PG': 'PG',
    'TV-14': 'PG-13',
    'TV-MA': 'R',
  };
  return certMap[certification] || 'PG';
}

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

    const { tmdb_id, type = 'movie' } = await req.json();
    
    if (!tmdb_id) {
      return new Response(
        JSON.stringify({ error: 'TMDB ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching TMDB details for: ${tmdb_id}, type: ${type}`);

    const endpoint = type === 'series' ? 'tv' : 'movie';
    
    // Fetch main details, credits, similar, and certifications in parallel
    const fetchPromises = [
      fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdb_id}?api_key=${TMDB_API_KEY}`),
      fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdb_id}/credits?api_key=${TMDB_API_KEY}`),
      fetch(`${TMDB_BASE_URL}/${endpoint}/${tmdb_id}/similar?api_key=${TMDB_API_KEY}`),
    ];

    // For movies, get release dates (certifications). For TV, get content ratings
    if (type === 'series') {
      fetchPromises.push(fetch(`${TMDB_BASE_URL}/tv/${tmdb_id}/content_ratings?api_key=${TMDB_API_KEY}`));
    } else {
      fetchPromises.push(fetch(`${TMDB_BASE_URL}/movie/${tmdb_id}/release_dates?api_key=${TMDB_API_KEY}`));
    }

    const [detailsRes, creditsRes, similarRes, ratingsRes] = await Promise.all(fetchPromises);

    if (!detailsRes.ok) {
      console.error(`TMDB API error: ${detailsRes.status}`);
      throw new Error(`TMDB API error: ${detailsRes.status}`);
    }

    const details = await detailsRes.json();
    const credits = creditsRes.ok ? await creditsRes.json() : { cast: [], crew: [] };
    const similar = similarRes.ok ? await similarRes.json() : { results: [] };
    const ratingsData = ratingsRes.ok ? await ratingsRes.json() : { results: [] };

    // Get director for movies
    const director = credits.crew?.find((c: any) => c.job === 'Director');
    
    // Get top cast (first 10)
    const cast = (credits.cast || []).slice(0, 10).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profile_path: c.profile_path ? `${TMDB_IMAGE_BASE}${c.profile_path}` : null,
    }));

    // Get similar content (first 6) with genres
    const recommendations = (similar.results || []).slice(0, 6).map((r: any) => ({
      tmdb_id: r.id,
      title: type === 'series' ? r.name : r.title,
      thumbnail_url: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : null,
      year: (type === 'series' ? r.first_air_date : r.release_date)?.split('-')[0],
      rating: r.vote_average?.toFixed(1),
      genre_ids: r.genre_ids || [],
    }));

    // Extract content rating
    let contentRating = 'PG';
    if (type === 'series') {
      // TV content ratings
      const usRating = ratingsData.results?.find((r: any) => r.iso_3166_1 === 'US');
      if (usRating?.rating) {
        contentRating = mapCertification(usRating.rating);
      }
    } else {
      // Movie certifications from release dates
      const usRelease = ratingsData.results?.find((r: any) => r.iso_3166_1 === 'US');
      const certification = usRelease?.release_dates?.find((rd: any) => rd.certification)?.certification;
      if (certification) {
        contentRating = mapCertification(certification);
      }
    }

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
      content_rating: contentRating,
    };

    console.log(`Found details for: ${enrichedData.title}, content_rating: ${contentRating}`);
    
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
