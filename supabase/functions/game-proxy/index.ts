import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Allowlist of domains that can be proxied
// Only add domains that explicitly allow embedding or have compatible licenses
const ALLOWED_DOMAINS = [
  "crazygames.com",
  "www.crazygames.com",
  "games.crazygames.com",
  "poki.com",
  "www.poki.com",
  "cdn.poki.com",
  "kizi.com",
  "www.kizi.com",
  "gameflare.com",
  "www.gameflare.com",
  "silvergames.com",
  "www.silvergames.com",
];

function isAllowedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ALLOWED_DOMAINS.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function rewriteUrls(html: string, baseUrl: string, proxyBaseUrl: string): string {
  const base = new URL(baseUrl);
  
  // Rewrite relative URLs to absolute
  html = html.replace(
    /(href|src|action)=["'](?!https?:\/\/|\/\/|data:|javascript:|#)([^"']+)["']/gi,
    (match, attr, path) => {
      const absoluteUrl = new URL(path, base).href;
      return `${attr}="${absoluteUrl}"`;
    }
  );

  return html;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const gameUrl = url.searchParams.get("url");
    const gameId = url.searchParams.get("gameId");

    if (!gameUrl) {
      return new Response(
        JSON.stringify({ error: "Missing 'url' parameter" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate URL format
    let targetUrl: URL;
    try {
      targetUrl = new URL(gameUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Security check: Only allow HTTPS
    if (targetUrl.protocol !== "https:") {
      return new Response(
        JSON.stringify({ error: "Only HTTPS URLs are allowed" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Security check: Domain allowlist
    if (!isAllowedDomain(gameUrl)) {
      return new Response(
        JSON.stringify({ 
          error: "Domain not allowed for proxying",
          allowed_domains: ALLOWED_DOMAINS 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate gameId if provided (ensures the game exists in our database)
    if (gameId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { data: game, error } = await supabase
        .from("playable_games")
        .select("id, embed_url, embed_type")
        .eq("id", gameId)
        .eq("is_active", true)
        .single();

      if (error || !game) {
        return new Response(
          JSON.stringify({ error: "Game not found or inactive" }),
          { 
            status: 404, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      // Verify the URL matches the game's embed_url
      if (game.embed_url !== gameUrl) {
        return new Response(
          JSON.stringify({ error: "URL mismatch with registered game" }),
          { 
            status: 403, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
    }

    console.log(`Proxying game: ${gameUrl}`);

    // Fetch the game content
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    // Enhanced headers for better compatibility with game providers
    const response = await fetch(gameUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Origin": targetUrl.origin,
        "Referer": `${targetUrl.origin}/`,
        "Sec-Fetch-Dest": "iframe",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-CH-UA": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch game: ${response.status}` }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const body = await response.arrayBuffer();

    // Some providers return HTML with text/plain content-type.
    // Sniff the beginning of the body to detect HTML reliably.
    const sniff = new TextDecoder().decode(body.slice(0, 256)).toLowerCase();
    const looksLikeHtml =
      contentType.includes("text/html") ||
      sniff.includes("<!doctype html") ||
      sniff.includes("<html");

    // For HTML content, we need to process it
    if (looksLikeHtml) {
      let html = new TextDecoder().decode(body);

      // Rewrite URLs to be absolute
      const proxyBaseUrl = `${url.origin}${url.pathname}`;
      html = rewriteUrls(html, gameUrl, proxyBaseUrl);

      // Add base tag to help with relative URLs
      html = html.replace(
        /<head([^>]*)>/i,
        `<head$1><base href="${targetUrl.origin}/">`
      );

      // Allow the embedded app to load its assets/scripts.
      // Note: this runs inside a sandboxed iframe on our side.
      const permissiveCsp = [
        "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'",
        "script-src * data: blob: 'unsafe-inline' 'unsafe-eval'",
        "style-src * 'unsafe-inline'",
        "img-src * data: blob:",
        "font-src * data:",
        "connect-src * data: blob:",
        "media-src * data: blob:",
        "frame-src *",
        "frame-ancestors *",
      ].join("; ");

      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          // Remove blocking headers
          "X-Frame-Options": "ALLOWALL",
          "Content-Security-Policy": permissiveCsp,
          "Cross-Origin-Resource-Policy": "cross-origin",
        },
      });
    }

    // For other content types (JS, CSS, images), pass through
    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const error = err as Error;
    console.error("Proxy error:", error);
    
    if (error.name === "AbortError") {
      return new Response(
        JSON.stringify({ error: "Request timed out" }),
        { 
          status: 504, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
