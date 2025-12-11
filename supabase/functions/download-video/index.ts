import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();
    
    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: 'Video URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Proxying video download:', videoUrl);

    // Fetch the video from the CDN
    const videoResponse = await fetch(videoUrl);
    
    if (!videoResponse.ok) {
      console.error('Failed to fetch video:', videoResponse.status, videoResponse.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch video from source' }),
        { status: videoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentLength = videoResponse.headers.get('content-length');
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4';

    // Build response headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    };

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }

    console.log('Streaming video, size:', contentLength, 'type:', contentType);

    return new Response(videoResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Download proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
