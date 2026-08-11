// Pulls real-world trending titles from TMDB and matches them against our catalog.
// Results land in public.external_trends and feed the AI homepage audit.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TMDB = "https://api.themoviedb.org/3";

interface TrendRow {
  source: string;
  tmdb_id: number;
  imdb_id: string | null;
  title: string;
  media_type: string;
  release_year: number | null;
  genres: string[];
  popularity: number;
  vote_average: number;
  trend_rank: number;
  trend_window: string;
  poster_path: string | null;
  content_id: string | null;
  is_owned: boolean;
  fetched_at: string;
}

function normalizeTitle(t: string): string {
  return (t || "")
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function tmdbGet(path: string, key: string): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${TMDB}${path}${sep}api_key=${key}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TMDB ${path} failed [${res.status}]: ${body}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const tmdbKey = Deno.env.get("TMDB_API_KEY");
    if (!tmdbKey) throw new Error("Missing TMDB_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Genre dictionaries (movie + tv)
    const [movieGenres, tvGenres] = await Promise.all([
      tmdbGet("/genre/movie/list", tmdbKey),
      tmdbGet("/genre/tv/list", tmdbKey),
    ]);
    const genreMap = new Map<number, string>();
    [...(movieGenres?.genres ?? []), ...(tvGenres?.genres ?? [])].forEach((g: any) =>
      genreMap.set(g.id, g.name),
    );

    // Trend feeds we care about
    const feeds: Array<{ path: string; window: string; media?: string }> = [
      { path: "/trending/all/day", window: "day" },
      { path: "/trending/all/week", window: "week" },
      { path: "/movie/popular", window: "popular_movie", media: "movie" },
      { path: "/tv/popular", window: "popular_tv", media: "tv" },
      { path: "/movie/top_rated", window: "top_rated_movie", media: "movie" },
      { path: "/tv/top_rated", window: "top_rated_tv", media: "tv" },
    ];

    const rows: TrendRow[] = [];
    const now = new Date().toISOString();

    for (const feed of feeds) {
      try {
        const json = await tmdbGet(feed.path, tmdbKey);
        const results: any[] = (json?.results ?? []).slice(0, 20);
        results.forEach((r, i) => {
          const mediaType = r.media_type ?? feed.media ?? "movie";
          if (mediaType !== "movie" && mediaType !== "tv") return;
          const title = r.title ?? r.name ?? "";
          if (!title) return;
          const dateStr = r.release_date ?? r.first_air_date ?? "";
          const year = dateStr ? Number(String(dateStr).slice(0, 4)) : null;
          rows.push({
            source: "tmdb",
            tmdb_id: r.id,
            imdb_id: null,
            title,
            media_type: mediaType,
            release_year: Number.isFinite(year as number) ? (year as number) : null,
            genres: (r.genre_ids ?? []).map((g: number) => genreMap.get(g)).filter(Boolean) as string[],
            popularity: Number(r.popularity ?? 0),
            vote_average: Number(r.vote_average ?? 0),
            trend_rank: i + 1,
            trend_window: feed.window,
            poster_path: r.poster_path ?? null,
            content_id: null,
            is_owned: false,
            fetched_at: now,
          });
        });
      } catch (e) {
        console.error("Feed failed", feed.path, e);
      }
    }

    // Match against catalog: tmdb_id first, then normalized title + year (±1)
    const { data: catalog } = await supabase
      .from("content")
      .select("id,title,year,tmdb_id");

    const byTmdb = new Map<number, string>();
    const byTitle = new Map<string, Array<{ id: string; year: number | null }>>();
    (catalog ?? []).forEach((c: any) => {
      if (c.tmdb_id) byTmdb.set(Number(c.tmdb_id), c.id);
      const key = normalizeTitle(c.title);
      if (!key) return;
      const list = byTitle.get(key) ?? [];
      list.push({ id: c.id, year: c.year ?? null });
      byTitle.set(key, list);
    });

    for (const row of rows) {
      const direct = byTmdb.get(row.tmdb_id);
      if (direct) {
        row.content_id = direct;
        row.is_owned = true;
        continue;
      }
      const candidates = byTitle.get(normalizeTitle(row.title)) ?? [];
      const match = candidates.find(
        (c) =>
          !row.release_year ||
          !c.year ||
          Math.abs((c.year ?? 0) - (row.release_year ?? 0)) <= 1,
      );
      if (match) {
        row.content_id = match.id;
        row.is_owned = true;
      }
    }

    // Replace previous snapshot for the windows we just refreshed
    const windows = [...new Set(rows.map((r) => r.trend_window))];
    if (windows.length > 0) {
      await supabase.from("external_trends").delete().in("trend_window", windows);
    }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase.from("external_trends").insert(chunk);
      if (error) console.error("Insert error", error);
      else inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        fetched: rows.length,
        inserted,
        owned: rows.filter((r) => r.is_owned).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("tmdb-trends-sync error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
