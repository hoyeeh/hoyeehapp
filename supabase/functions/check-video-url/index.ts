import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CheckResult {
  url: string;
  valid: boolean;
  status?: number;
  error?: string;
  contentType?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls)) {
      return new Response(
        JSON.stringify({ error: "urls array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking ${urls.length} video URL(s)`);

    const results: CheckResult[] = await Promise.all(
      urls.map(async (url: string): Promise<CheckResult> => {
        if (!url || url.trim() === "") {
          return { url, valid: false, error: "Empty URL" };
        }

        try {
          // Basic URL validation
          new URL(url);
        } catch {
          return { url, valid: false, error: "Invalid URL format" };
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(url, {
            method: "HEAD",
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const contentType = response.headers.get("content-type") || undefined;

          if (response.ok) {
            return {
              url,
              valid: true,
              status: response.status,
              contentType,
            };
          } else if (response.status === 403) {
            // CORS / permission issues on HEAD – might still work for video element
            return {
              url,
              valid: true,
              status: response.status,
              contentType,
              error: "CORS may block HEAD but video may still load",
            };
          } else {
            return {
              url,
              valid: false,
              status: response.status,
              error: `HTTP ${response.status}`,
            };
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("AbortError") || message.includes("aborted")) {
            return { url, valid: false, error: "Timeout" };
          }
          // Network / CORS errors – treat as potentially valid
          if (message.includes("CORS") || message.includes("NetworkError")) {
            return { url, valid: true, error: "Could not verify due to CORS" };
          }
          return { url, valid: false, error: message };
        }
      })
    );

    const brokenCount = results.filter((r) => !r.valid).length;
    console.log(`Check complete: ${brokenCount} broken out of ${results.length}`);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in check-video-url:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
