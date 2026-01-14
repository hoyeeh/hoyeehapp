import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= SUBTITLE UTILITIES =============

// Normalize title for matching
function normalizeTitle(title: string): string {
  return title
    .replace(/[._-]/g, ' ')
    .replace(/\s*(720p|1080p|2160p|4k|HDRip|BluRay|WEB-DL|HDTV|DVDRip|x264|x265|HEVC)\s*/gi, '')
    .replace(/\s*(S\d{1,2}E\d{1,2}|Season\s*\d+|Episode\s*\d+)\s*/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Extract season/episode from text
function extractSeasonEpisode(text: string): { season?: number; episode?: number } {
  const patterns = [
    /S(\d{1,2})E(\d{1,2})/i,
    /(\d{1,2})x(\d{1,2})/i,
    /Season\s*(\d{1,2})\s*Episode\s*(\d{1,2})/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match.length === 3) {
      return { season: parseInt(match[1]), episode: parseInt(match[2]) };
    }
  }
  return {};
}

// Convert SRT to VTT format
function convertSrtToVtt(srtContent: string): string {
  let vttContent = 'WEBVTT\n\n';
  
  const blocks = srtContent.trim().split(/\n\n+/);
  
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;
    
    // Skip the index line, get timestamp line
    const timeLine = lines[1];
    if (!timeLine || !timeLine.includes('-->')) continue;
    
    // Convert SRT timestamps (comma) to VTT (period)
    const vttTimeLine = timeLine.replace(/,/g, '.');
    
    // Get text content
    const textLines = lines.slice(2).join('\n');
    
    vttContent += `${vttTimeLine}\n${textLines}\n\n`;
  }
  
  return vttContent;
}

// ============= OPENSUBTITLES API =============

interface OpenSubtitlesResult {
  id: string;
  attributes: {
    subtitle_id: string;
    language: string;
    download_count: number;
    new_download_count: number;
    hearing_impaired: boolean;
    fps: number;
    votes: number;
    ratings: number;
    from_trusted: boolean;
    foreign_parts_only: boolean;
    upload_date: string;
    ai_translated: boolean;
    nb_cd: number;
    machine_translated: boolean;
    release: string;
    comments: string;
    legacy_subtitle_id: number;
    legacy_uploader_id: number;
    uploader: {
      uploader_id: number;
      name: string;
      rank: string;
    };
    feature_details: {
      feature_id: number;
      feature_type: string;
      year: number;
      title: string;
      movie_name: string;
      imdb_id: number;
      tmdb_id: number;
      season_number?: number;
      episode_number?: number;
      parent_imdb_id?: number;
      parent_title?: string;
      parent_tmdb_id?: number;
      parent_feature_id?: number;
    };
    url: string;
    related_links: Array<{ label: string; url: string; img_url: string }>;
    files: Array<{
      file_id: number;
      cd_number: number;
      file_name: string;
    }>;
  };
}

async function searchOpenSubtitles(
  apiKey: string,
  query: string,
  language: string,
  tmdbId?: number,
  seasonNumber?: number,
  episodeNumber?: number,
  contentType?: string
): Promise<OpenSubtitlesResult[]> {
  const baseUrl = 'https://api.opensubtitles.com/api/v1/subtitles';
  
  const params = new URLSearchParams();
  params.append('languages', language);
  
  // Prefer TMDB ID for exact match
  if (tmdbId) {
    params.append('tmdb_id', tmdbId.toString());
    
    // For TV shows, add season and episode
    if (contentType === 'series' && seasonNumber !== undefined && episodeNumber !== undefined) {
      params.append('season_number', seasonNumber.toString());
      params.append('episode_number', episodeNumber.toString());
    }
  } else {
    params.append('query', query);
  }
  
  console.log(`[OpenSubtitles] Searching: ${baseUrl}?${params.toString()}`);
  
  const response = await fetch(`${baseUrl}?${params.toString()}`, {
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'Hoyeeh v1.0',
    },
  });
  
  if (!response.ok) {
    console.error(`[OpenSubtitles] Search failed: ${response.status} ${response.statusText}`);
    const errorText = await response.text();
    console.error(`[OpenSubtitles] Error body: ${errorText}`);
    return [];
  }
  
  const data = await response.json();
  console.log(`[OpenSubtitles] Found ${data.data?.length || 0} results`);
  
  return data.data || [];
}

async function downloadOpenSubtitle(
  apiKey: string,
  fileId: number
): Promise<string | null> {
  const response = await fetch('https://api.opensubtitles.com/api/v1/download', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'Hoyeeh v1.0',
    },
    body: JSON.stringify({ file_id: fileId }),
  });
  
  if (!response.ok) {
    console.error(`[OpenSubtitles] Download request failed: ${response.status}`);
    return null;
  }
  
  const data = await response.json();
  
  if (!data.link) {
    console.error('[OpenSubtitles] No download link in response');
    return null;
  }
  
  // Download the actual subtitle file
  const fileResponse = await fetch(data.link);
  if (!fileResponse.ok) {
    console.error(`[OpenSubtitles] File download failed: ${fileResponse.status}`);
    return null;
  }
  
  return await fileResponse.text();
}

// ============= FALLBACK SCRAPERS =============

interface ScraperSource {
  name: string;
  url: string;
  type: 'movies' | 'tv' | 'movies+tv';
  scrape: (title: string, language: string, season?: number, episode?: number, year?: number) => Promise<string | null>;
}

// Podnapisi.net scraper
async function scrapePodnapisi(
  title: string, 
  language: string, 
  season?: number, 
  episode?: number,
  year?: number
): Promise<string | null> {
  try {
    const langMap: Record<string, string> = { en: 'en', fr: 'fr' };
    const lang = langMap[language] || 'en';
    
    let searchUrl = `https://www.podnapisi.net/subtitles/search/${encodeURIComponent(title)}?language=${lang}`;
    if (season !== undefined && episode !== undefined) {
      searchUrl += `&seasons=${season}&episodes=${episode}`;
    }
    if (year) {
      searchUrl += `&year=${year}`;
    }
    
    console.log(`[Podnapisi] Searching: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Extract download link from HTML
    const downloadMatch = html.match(/href="(\/subtitles\/[^"]+\/download)"/);
    if (!downloadMatch) return null;
    
    const downloadUrl = `https://www.podnapisi.net${downloadMatch[1]}`;
    
    const subtitleResponse = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!subtitleResponse.ok) return null;
    
    const contentType = subtitleResponse.headers.get('content-type') || '';
    
    // Skip zip/rar files
    if (contentType.includes('zip') || contentType.includes('rar')) {
      console.log('[Podnapisi] Skipping compressed file');
      return null;
    }
    
    return await subtitleResponse.text();
  } catch (error) {
    console.error('[Podnapisi] Scrape error:', error);
    return null;
  }
}

// YIFY Subtitles scraper (movies only)
async function scrapeYifySubtitles(
  title: string, 
  language: string,
  _season?: number,
  _episode?: number,
  year?: number
): Promise<string | null> {
  try {
    const searchQuery = year ? `${title} ${year}` : title;
    const searchUrl = `https://yifysubtitles.ch/search?q=${encodeURIComponent(searchQuery)}`;
    
    console.log(`[YIFY] Searching: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Find movie page link
    const movieMatch = html.match(/href="(\/movie-imdb\/[^"]+)"/);
    if (!movieMatch) return null;
    
    const movieUrl = `https://yifysubtitles.ch${movieMatch[1]}`;
    const movieResponse = await fetch(movieUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!movieResponse.ok) return null;
    
    const movieHtml = await movieResponse.text();
    
    // Find subtitle for language
    const langCode = language === 'fr' ? 'french' : 'english';
    const subtitleRegex = new RegExp(`href="(/subtitle/[^"]+)"[^>]*>\\s*${langCode}`, 'i');
    const subtitleMatch = movieHtml.match(subtitleRegex);
    
    if (!subtitleMatch) return null;
    
    // Get subtitle page to find download link
    const subtitlePageUrl = `https://yifysubtitles.ch${subtitleMatch[1]}`;
    const subtitlePageResponse = await fetch(subtitlePageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!subtitlePageResponse.ok) return null;
    
    const subtitlePageHtml = await subtitlePageResponse.text();
    const downloadMatch = subtitlePageHtml.match(/href="([^"]+\.srt)"/i);
    
    if (!downloadMatch) return null;
    
    const subtitleResponse = await fetch(downloadMatch[1], {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!subtitleResponse.ok) return null;
    
    return await subtitleResponse.text();
  } catch (error) {
    console.error('[YIFY] Scrape error:', error);
    return null;
  }
}

// TVSubtitles.net scraper (TV shows only)
async function scrapeTvSubtitles(
  title: string, 
  language: string,
  season?: number,
  episode?: number
): Promise<string | null> {
  if (season === undefined || episode === undefined) return null;
  
  try {
    const normalizedTitle = normalizeTitle(title).replace(/\s+/g, '-');
    const searchUrl = `http://www.tvsubtitles.net/search.php?q=${encodeURIComponent(title)}`;
    
    console.log(`[TVSubtitles] Searching: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Find show link
    const showMatch = html.match(/href="(\/tvshow-\d+-\d+\.html)"/);
    if (!showMatch) return null;
    
    // Navigate to season/episode
    const showUrl = `http://www.tvsubtitles.net${showMatch[1]}`;
    const showResponse = await fetch(showUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!showResponse.ok) return null;
    
    const showHtml = await showResponse.text();
    
    // Find episode link for season/episode
    const episodePattern = new RegExp(`href="(/subtitle-\\d+\\.html)"[^>]*>${season}x${episode.toString().padStart(2, '0')}`, 'i');
    const episodeMatch = showHtml.match(episodePattern);
    
    if (!episodeMatch) return null;
    
    // Get subtitle list for episode
    const episodeUrl = `http://www.tvsubtitles.net${episodeMatch[1]}`;
    const episodeResponse = await fetch(episodeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!episodeResponse.ok) return null;
    
    const episodeHtml = await episodeResponse.text();
    
    // Find subtitle for language
    const langCode = language === 'fr' ? 'French' : 'English';
    const subtitlePattern = new RegExp(`href="(/download-\\d+\\.html)"[^>]*>.*?${langCode}`, 'is');
    const subtitleMatch = episodeHtml.match(subtitlePattern);
    
    if (!subtitleMatch) return null;
    
    const downloadUrl = `http://www.tvsubtitles.net${subtitleMatch[1]}`;
    const subtitleResponse = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!subtitleResponse.ok) return null;
    
    const contentType = subtitleResponse.headers.get('content-type') || '';
    if (contentType.includes('zip') || contentType.includes('rar')) {
      return null;
    }
    
    return await subtitleResponse.text();
  } catch (error) {
    console.error('[TVSubtitles] Scrape error:', error);
    return null;
  }
}

// Addic7ed scraper (TV shows)
async function scrapeAddic7ed(
  title: string, 
  language: string,
  season?: number,
  episode?: number
): Promise<string | null> {
  if (season === undefined || episode === undefined) return null;
  
  try {
    const normalizedTitle = normalizeTitle(title);
    const searchUrl = `https://www.addic7ed.com/search.php?search=${encodeURIComponent(title)}&Submit=Search`;
    
    console.log(`[Addic7ed] Searching: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://www.addic7ed.com/',
      },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Find show link
    const showMatch = html.match(/href="(\/show\/\d+)"/);
    if (!showMatch) return null;
    
    // Navigate to episode page
    const episodeUrl = `https://www.addic7ed.com/serie/${encodeURIComponent(title)}/${season}/${episode}/0`;
    
    const episodeResponse = await fetch(episodeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.addic7ed.com/',
      },
    });
    
    if (!episodeResponse.ok) return null;
    
    const episodeHtml = await episodeResponse.text();
    
    // Find download link for language
    const langCode = language === 'fr' ? 'French' : 'English';
    const downloadPattern = new RegExp(`href="(/original/\\d+/\\d+)"[^>]*>.*?${langCode}.*?Download`, 'is');
    const downloadMatch = episodeHtml.match(downloadPattern);
    
    if (!downloadMatch) return null;
    
    const downloadUrl = `https://www.addic7ed.com${downloadMatch[1]}`;
    const subtitleResponse = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': episodeUrl,
      },
    });
    
    if (!subtitleResponse.ok) return null;
    
    return await subtitleResponse.text();
  } catch (error) {
    console.error('[Addic7ed] Scrape error:', error);
    return null;
  }
}

// MovieSubtitles.org scraper (movies only)
async function scrapeMovieSubtitles(
  title: string, 
  language: string,
  _season?: number,
  _episode?: number,
  year?: number
): Promise<string | null> {
  try {
    const searchQuery = year ? `${title} ${year}` : title;
    const searchUrl = `http://www.moviesubtitles.org/search.php?q=${encodeURIComponent(searchQuery)}`;
    
    console.log(`[MovieSubtitles] Searching: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Find movie link
    const movieMatch = html.match(/href="(\/movie-\d+\.html)"/);
    if (!movieMatch) return null;
    
    const movieUrl = `http://www.moviesubtitles.org${movieMatch[1]}`;
    const movieResponse = await fetch(movieUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!movieResponse.ok) return null;
    
    const movieHtml = await movieResponse.text();
    
    // Find subtitle for language
    const langCode = language === 'fr' ? 'French' : 'English';
    const subtitlePattern = new RegExp(`href="(/subtitle-\\d+\\.html)"[^>]*>.*?${langCode}`, 'is');
    const subtitleMatch = movieHtml.match(subtitlePattern);
    
    if (!subtitleMatch) return null;
    
    const subtitleUrl = `http://www.moviesubtitles.org${subtitleMatch[1]}`;
    const subtitlePageResponse = await fetch(subtitleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!subtitlePageResponse.ok) return null;
    
    const subtitlePageHtml = await subtitlePageResponse.text();
    const downloadMatch = subtitlePageHtml.match(/href="([^"]+\.srt)"/i);
    
    if (!downloadMatch) return null;
    
    const subtitleResponse = await fetch(downloadMatch[1], {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!subtitleResponse.ok) return null;
    
    return await subtitleResponse.text();
  } catch (error) {
    console.error('[MovieSubtitles] Scrape error:', error);
    return null;
  }
}

// Main fallback scraper with retry logic
async function tryFallbackScrapers(
  title: string,
  language: string,
  contentType: string,
  season?: number,
  episode?: number,
  year?: number
): Promise<{ source: string; content: string } | null> {
  const isMovie = contentType === 'movie';
  
  const scrapers: { name: string; scrape: () => Promise<string | null> }[] = [];
  
  // Add appropriate scrapers based on content type
  scrapers.push({ name: 'podnapisi', scrape: () => scrapePodnapisi(title, language, season, episode, year) });
  
  if (isMovie) {
    scrapers.push({ name: 'yifysubtitles', scrape: () => scrapeYifySubtitles(title, language, undefined, undefined, year) });
    scrapers.push({ name: 'moviesubtitles', scrape: () => scrapeMovieSubtitles(title, language, undefined, undefined, year) });
  } else {
    scrapers.push({ name: 'addic7ed', scrape: () => scrapeAddic7ed(title, language, season, episode) });
    scrapers.push({ name: 'tvsubtitles', scrape: () => scrapeTvSubtitles(title, language, season, episode) });
  }
  
  for (const scraper of scrapers) {
    console.log(`[Fallback] Trying ${scraper.name}...`);
    
    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const content = await scraper.scrape();
        if (content && content.length > 100) { // Basic validation
          console.log(`[Fallback] Success from ${scraper.name}`);
          return { source: scraper.name, content };
        }
        break; // No content, try next scraper
      } catch (error) {
        console.error(`[Fallback] ${scraper.name} attempt ${attempt} failed:`, error);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    
    // Rate limit between scrapers
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return null;
}

// ============= UPLOAD TO STORAGE =============

async function uploadToSpaces(
  content: string,
  contentId: string,
  episodeId: string | null,
  languageCode: string,
  supabase: any
): Promise<{ url: string; provider: string } | null> {
  const spacesEndpoint = Deno.env.get('DO_SPACES_ENDPOINT');
  const spacesKey = Deno.env.get('DO_SPACES_KEY');
  const spacesSecret = Deno.env.get('DO_SPACES_SECRET');
  const spacesBucket = Deno.env.get('DO_SPACES_BUCKET');
  const cdnEndpoint = Deno.env.get('DO_SPACES_CDN_ENDPOINT');
  
  const path = episodeId 
    ? `subtitles/${contentId}/${episodeId}/${languageCode}.vtt`
    : `subtitles/${contentId}/${languageCode}.vtt`;
  
  // Try DO Spaces first
  if (spacesEndpoint && spacesKey && spacesSecret && spacesBucket) {
    try {
      // Create AWS-style signature for S3-compatible upload
      const { S3Client, PutObjectCommand } = await import("https://esm.sh/@aws-sdk/client-s3@3.490.0");
      
      const s3Client = new S3Client({
        endpoint: spacesEndpoint,
        region: Deno.env.get('DO_SPACES_REGION') || 'nyc3',
        credentials: {
          accessKeyId: spacesKey,
          secretAccessKey: spacesSecret,
        },
      });
      
      const command = new PutObjectCommand({
        Bucket: spacesBucket,
        Key: path,
        Body: content,
        ContentType: 'text/vtt',
        ACL: 'public-read',
      });
      
      await s3Client.send(command);
      
      const cdnUrl = cdnEndpoint 
        ? `${cdnEndpoint}/${path}`
        : `${spacesEndpoint}/${spacesBucket}/${path}`;
      
      console.log(`[Upload] Successfully uploaded to DO Spaces: ${cdnUrl}`);
      return { url: cdnUrl, provider: 'do_spaces' };
    } catch (error) {
      console.warn('[Upload] DO Spaces failed, falling back to Supabase Storage:', error);
    }
  } else {
    console.warn('[Upload] DO Spaces credentials not configured, using Supabase Storage');
  }
  
  // Fallback to Supabase Storage
  try {
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(content);
    
    const { error: storageError } = await supabase.storage
      .from('subtitles')
      .upload(path, contentBytes, {
        contentType: 'text/vtt',
        upsert: true
      });
    
    if (storageError) {
      console.error('[Upload] Supabase Storage also failed:', storageError);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('subtitles')
      .getPublicUrl(path);
    
    console.log(`[Upload] Successfully uploaded to Supabase Storage: ${publicUrl}`);
    return { url: publicUrl, provider: 'supabase' };
  } catch (error) {
    console.error('[Upload] Supabase Storage failed:', error);
    return null;
  }
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { contentId, episodeId, languages = ['en', 'fr'] } = await req.json();
    
    if (!contentId) {
      return new Response(
        JSON.stringify({ error: 'Content ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openSubtitlesApiKey = Deno.env.get('OPENSUBTITLES_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch content metadata
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('id, title, tmdb_id, content_type, year')
      .eq('id', contentId)
      .single();
    
    if (contentError || !content) {
      console.error('[AutoFetch] Content not found:', contentError);
      return new Response(
        JSON.stringify({ error: 'Content not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch episode info if episodeId provided
    let seasonNumber: number | undefined;
    let episodeNumber: number | undefined;
    
    if (episodeId) {
      const { data: episode, error: episodeError } = await supabase
        .from('episodes')
        .select(`
          id,
          episode_number,
          seasons!inner(season_number)
        `)
        .eq('id', episodeId)
        .single();
      
      if (!episodeError && episode) {
        episodeNumber = episode.episode_number;
        seasonNumber = (episode.seasons as any)?.season_number;
      }
    }
    
    const results = {
      fetched: [] as { language: string; source: string; url: string }[],
      skipped: [] as { language: string; reason: string }[],
      failed: [] as { language: string; error: string }[],
    };
    
    for (const lang of languages) {
      console.log(`[AutoFetch] Processing language: ${lang}`);
      
      // Check if subtitle already exists
      let existsQuery = supabase
        .from('subtitles')
        .select('id')
        .eq('content_id', contentId)
        .eq('language_code', lang === 'en' ? 'eng' : lang === 'fr' ? 'fra' : lang);
      
      if (episodeId) {
        existsQuery = existsQuery.eq('episode_id', episodeId);
      } else {
        existsQuery = existsQuery.is('episode_id', null);
      }
      
      const { data: existing } = await existsQuery.maybeSingle();
      
      if (existing) {
        console.log(`[AutoFetch] Subtitle already exists for ${lang}`);
        results.skipped.push({ language: lang, reason: 'already_exists' });
        continue;
      }
      
      let subtitleContent: string | null = null;
      let source = '';
      let externalId = '';
      let matchConfidence = 0;
      let externalMetadata: any = null;
      
      // Try OpenSubtitles API first
      if (openSubtitlesApiKey) {
        console.log(`[AutoFetch] Trying OpenSubtitles for ${lang}...`);
        
        const osResults = await searchOpenSubtitles(
          openSubtitlesApiKey,
          content.title,
          lang,
          content.tmdb_id,
          seasonNumber,
          episodeNumber,
          content.content_type
        );
        
        if (osResults.length > 0) {
          // Sort by download count and get best match
          const sorted = osResults.sort((a, b) => 
            (b.attributes.download_count || 0) - (a.attributes.download_count || 0)
          );
          
          const best = sorted[0];
          const fileId = best.attributes.files[0]?.file_id;
          
          if (fileId) {
            subtitleContent = await downloadOpenSubtitle(openSubtitlesApiKey, fileId);
            
            if (subtitleContent) {
              source = 'opensubtitles';
              externalId = best.id;
              matchConfidence = content.tmdb_id ? 1.0 : 0.8;
              externalMetadata = {
                subtitle_id: best.attributes.subtitle_id,
                download_count: best.attributes.download_count,
                from_trusted: best.attributes.from_trusted,
                uploader: best.attributes.uploader?.name,
              };
            }
          }
        }
      }
      
      // Try fallback scrapers if OpenSubtitles failed
      if (!subtitleContent) {
        console.log(`[AutoFetch] Trying fallback scrapers for ${lang}...`);
        
        const fallbackResult = await tryFallbackScrapers(
          content.title,
          lang,
          content.content_type,
          seasonNumber,
          episodeNumber,
          content.year
        );
        
        if (fallbackResult) {
          subtitleContent = fallbackResult.content;
          source = fallbackResult.source;
          matchConfidence = 0.6;
        }
      }
      
      if (!subtitleContent) {
        console.log(`[AutoFetch] No subtitles found for ${lang}`);
        
        // Update fetch attempts
        await supabase
          .from('subtitles')
          .upsert({
            content_id: contentId,
            episode_id: episodeId || null,
            language_code: lang === 'en' ? 'eng' : lang === 'fr' ? 'fra' : lang,
            language_label: lang === 'en' ? 'English' : lang === 'fr' ? 'Français' : lang,
            subtitle_url: '',
            source_type: 'external_failed',
            fetch_attempts: 1,
            last_fetch_attempt: new Date().toISOString(),
          }, {
            onConflict: 'content_id,episode_id,language_code',
            ignoreDuplicates: false,
          });
        
        results.failed.push({ language: lang, error: 'No subtitles found' });
        continue;
      }
      
      // Convert SRT to VTT if needed
      if (subtitleContent.includes(',') && !subtitleContent.startsWith('WEBVTT')) {
        subtitleContent = convertSrtToVtt(subtitleContent);
      }
      
      // Upload to DigitalOcean Spaces with Supabase Storage fallback
      const uploadResult = await uploadToSpaces(
        subtitleContent,
        contentId,
        episodeId || null,
        lang === 'en' ? 'eng' : lang === 'fr' ? 'fra' : lang,
        supabase
      );
      
      if (!uploadResult) {
        results.failed.push({ language: lang, error: 'Upload failed to both DO Spaces and Supabase Storage' });
        continue;
      }
      
      const { url: cdnUrl, provider: storageProvider } = uploadResult;
      console.log(`[AutoFetch] Uploaded ${lang} subtitle using ${storageProvider}`);
      
      // Save to database
      const { error: insertError } = await supabase
        .from('subtitles')
        .upsert({
          content_id: contentId,
          episode_id: episodeId || null,
          language_code: lang === 'en' ? 'eng' : lang === 'fr' ? 'fra' : lang,
          language_label: lang === 'en' ? 'English' : lang === 'fr' ? 'Français' : lang,
          subtitle_url: cdnUrl,
          cdn_url: cdnUrl,
          source_type: 'external',
          external_source: source,
          external_id: externalId,
          match_confidence: matchConfidence,
          external_metadata: externalMetadata,
          fetch_attempts: 1,
          last_fetch_attempt: new Date().toISOString(),
        }, {
          onConflict: 'content_id,episode_id,language_code',
          ignoreDuplicates: false,
        });
      
      if (insertError) {
        console.error(`[AutoFetch] Database insert error for ${lang}:`, insertError);
        results.failed.push({ language: lang, error: insertError.message });
      } else {
        console.log(`[AutoFetch] Successfully saved subtitle for ${lang} from ${source}`);
        results.fetched.push({ language: lang, source, url: cdnUrl });
      }
    }
    
    console.log('[AutoFetch] Complete:', JSON.stringify(results));
    
    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('[AutoFetch] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
