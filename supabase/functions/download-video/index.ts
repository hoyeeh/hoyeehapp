import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Check if user has an active subscription or is an admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_expiry')
      .eq('id', user.id)
      .single();

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'super_admin');
    const hasActiveSubscription = profile?.subscription_expiry && 
      new Date(profile.subscription_expiry) > new Date();

    if (!isAdmin && !hasActiveSubscription) {
      console.error('User does not have active subscription:', user.id);
      return new Response(
        JSON.stringify({ error: 'Active subscription required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { videoUrl } = await req.json();
    
    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: 'Video URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the video URL belongs to allowed domains (CDN or storage)
    const allowedDomains = [
      'cdn.digitaloceanspaces.com',
      'digitaloceanspaces.com',
      'supabase.co',
      'supabase.com'
    ];
    
    try {
      const urlObj = new URL(videoUrl);
      const isAllowedDomain = allowedDomains.some(domain => urlObj.hostname.includes(domain));
      
      if (!isAllowedDomain) {
        console.error('Invalid video URL domain:', urlObj.hostname);
        return new Response(
          JSON.stringify({ error: 'Invalid video source' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      console.error('Invalid URL format:', videoUrl);
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Proxying video download for user:', user.id, 'URL:', videoUrl);

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
