import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 downloads per minute per user

interface RateLimitData {
  count: number;
  window_start: string;
}

// Persistent rate limiting using database
async function checkPersistentRateLimit(
  supabase: any,
  userId: string,
  action: string
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const now = Date.now();
  
  try {
    // Get current rate limit record
    const { data, error: rateError } = await supabase
      .from('rate_limits')
      .select('count, window_start')
      .eq('user_id', userId)
      .eq('action', action)
      .maybeSingle();

    const rateData = data as RateLimitData | null;

    if (rateError) {
      console.error('[rate-limit] Database error:', rateError);
      // Fail open but log - don't block legitimate users due to DB issues
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetIn: RATE_LIMIT_WINDOW_MS };
    }

    const windowStart = rateData?.window_start ? new Date(rateData.window_start).getTime() : 0;
    const elapsed = now - windowStart;

    // Check if within rate limit window and exceeded
    if (rateData && elapsed < RATE_LIMIT_WINDOW_MS && rateData.count >= MAX_REQUESTS_PER_WINDOW) {
      const resetIn = RATE_LIMIT_WINDOW_MS - elapsed;
      console.warn(`[rate-limit] User ${userId} exceeded limit for ${action}: ${rateData.count}/${MAX_REQUESTS_PER_WINDOW}`);
      return { allowed: false, remaining: 0, resetIn };
    }

    // Update or create rate limit record
    const newCount = (rateData && elapsed < RATE_LIMIT_WINDOW_MS) ? rateData.count + 1 : 1;
    const newWindowStart = (rateData && elapsed < RATE_LIMIT_WINDOW_MS) 
      ? rateData.window_start 
      : new Date().toISOString();

    await supabase
      .from('rate_limits')
      .upsert({
        user_id: userId,
        action: action,
        count: newCount,
        window_start: newWindowStart,
      }, {
        onConflict: 'user_id,action'
      });

    const remaining = MAX_REQUESTS_PER_WINDOW - newCount;
    const resetIn = RATE_LIMIT_WINDOW_MS - (now - new Date(newWindowStart).getTime());

    console.log(`[rate-limit] User ${userId} ${action}: ${newCount}/${MAX_REQUESTS_PER_WINDOW}, remaining: ${remaining}`);
    return { allowed: true, remaining: Math.max(0, remaining), resetIn };
  } catch (error) {
    console.error('[rate-limit] Unexpected error:', error);
    // Fail open
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
}

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

    // Initialize Supabase client with service role for rate limit management
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Use anon key for user auth verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Use service role for rate limits and admin queries
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Check persistent rate limit
    const rateLimit = await checkPersistentRateLimit(supabaseAdmin, user.id, 'download_video');
    if (!rateLimit.allowed) {
      console.warn('Rate limit exceeded for user:', user.id);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetIn / 1000))
          } 
        }
      );
    }

    // Check if user has an active subscription or is an admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_expiry')
      .eq('id', user.id)
      .single();

    const { data: roles } = await supabaseAdmin
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

    const { videoUrl, rangeStart } = await req.json();
    
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

    console.log('Proxying video download for user:', user.id, 'URL:', videoUrl, 'rangeStart:', rangeStart);

    // Build fetch headers for range request if resuming
    const fetchHeaders: Record<string, string> = {};
    if (rangeStart && rangeStart > 0) {
      fetchHeaders['Range'] = `bytes=${rangeStart}-`;
      console.log('Requesting range:', fetchHeaders['Range']);
    }

    // Fetch the video from the CDN
    const videoResponse = await fetch(videoUrl, { headers: fetchHeaders });
    
    if (!videoResponse.ok && videoResponse.status !== 206) {
      console.error('Failed to fetch video:', videoResponse.status, videoResponse.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch video from source' }),
        { status: videoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentLength = videoResponse.headers.get('content-length');
    const contentRange = videoResponse.headers.get('content-range');
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4';

    // Build response headers with rate limit info
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetIn / 1000))
    };

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }

    const statusCode = rangeStart && rangeStart > 0 ? 206 : 200;
    console.log('Streaming video, size:', contentLength, 'range:', contentRange, 'type:', contentType, 'rate limit remaining:', rateLimit.remaining);

    return new Response(videoResponse.body, {
      status: statusCode,
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
