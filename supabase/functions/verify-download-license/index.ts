import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per user

interface RateLimitData {
  count: number;
  window_start: string;
}

// Persistent rate limiting using database
async function checkPersistentRateLimit(
  supabase: any,
  userId: string,
  action: string
): Promise<{ limited: boolean; retryAfter?: number }> {
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
      return { limited: false };
    }

    const windowStart = rateData?.window_start ? new Date(rateData.window_start).getTime() : 0;
    const elapsed = now - windowStart;

    // Check if within rate limit window and exceeded
    if (rateData && elapsed < RATE_LIMIT_WINDOW && rateData.count >= MAX_REQUESTS_PER_WINDOW) {
      const retryAfter = Math.ceil((RATE_LIMIT_WINDOW - elapsed) / 1000);
      console.warn(`[rate-limit] User ${userId} exceeded limit for ${action}: ${rateData.count}/${MAX_REQUESTS_PER_WINDOW}`);
      return { limited: true, retryAfter };
    }

    // Update or create rate limit record
    const newCount = (rateData && elapsed < RATE_LIMIT_WINDOW) ? rateData.count + 1 : 1;
    const newWindowStart = (rateData && elapsed < RATE_LIMIT_WINDOW) 
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

    console.log(`[rate-limit] User ${userId} ${action}: ${newCount}/${MAX_REQUESTS_PER_WINDOW}`);
    return { limited: false };
  } catch (error) {
    console.error('[rate-limit] Unexpected error:', error);
    // Fail open
    return { limited: false };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ canPlay: false, reason: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ canPlay: false, reason: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Persistent rate limiting check
    const rateCheck = await checkPersistentRateLimit(supabase, user.id, 'verify_license');
    if (rateCheck.limited) {
      console.warn(`[verify-license] Rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({ 
          canPlay: false, 
          reason: 'Too many requests. Please try again later.',
          code: 'RATE_LIMITED'
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter || 60)
          } 
        }
      );
    }

    // Parse request
    const { contentId, episodeId, deviceId } = await req.json();

    if (!contentId || !deviceId) {
      return new Response(
        JSON.stringify({ canPlay: false, reason: 'contentId and deviceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[verify-license] Checking license for user ${user.id}, content ${contentId}`);

    // Check user subscription status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_subscribed, subscription_expiry')
      .eq('id', user.id)
      .single();

    const isSubscribed = profile?.is_subscribed && 
      (!profile.subscription_expiry || new Date(profile.subscription_expiry) > new Date());

    if (!isSubscribed) {
      // Log failed attempt - potential abuse
      console.warn(`[SECURITY] License denied - subscription expired for user ${user.id}, content ${contentId}, device ${deviceId}`);
      
      // Revoke all licenses for this user
      await supabase
        .from('download_licenses')
        .update({ status: 'revoked' })
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ 
          canPlay: false, 
          reason: 'Subscription expired',
          code: 'SUBSCRIPTION_EXPIRED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the license
    let query = supabase
      .from('download_licenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('content_id', contentId)
      .eq('device_id', deviceId);

    if (episodeId) {
      query = query.eq('episode_id', episodeId);
    } else {
      query = query.is('episode_id', null);
    }

    const { data: license, error: licenseError } = await query.maybeSingle();

    if (licenseError) {
      console.error('[verify-license] Database error:', licenseError);
      return new Response(
        JSON.stringify({ canPlay: false, reason: 'License check failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!license) {
      // Log failed attempt - potential brute force
      console.warn(`[SECURITY] License not found - user ${user.id} attempted access to content ${contentId} on device ${deviceId}${episodeId ? `, episode ${episodeId}` : ''}`);
      
      return new Response(
        JSON.stringify({ 
          canPlay: false, 
          reason: 'No download license found',
          code: 'NO_LICENSE'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if license is expired
    const expiresAt = new Date(license.expires_at);
    if (expiresAt < new Date()) {
      // Update license status
      await supabase
        .from('download_licenses')
        .update({ status: 'expired' })
        .eq('id', license.id);

      return new Response(
        JSON.stringify({ 
          canPlay: false, 
          reason: 'License expired',
          expiresAt: expiresAt.getTime(),
          code: 'LICENSE_EXPIRED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if license was revoked
    if (license.status === 'revoked') {
      return new Response(
        JSON.stringify({ 
          canPlay: false, 
          reason: 'License has been revoked',
          code: 'LICENSE_REVOKED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last verified timestamp
    await supabase
      .from('download_licenses')
      .update({ last_verified: new Date().toISOString() })
      .eq('id', license.id);

    console.log(`[verify-license] License valid for content ${contentId}, expires ${expiresAt}`);

    return new Response(
      JSON.stringify({
        canPlay: true,
        expiresAt: expiresAt.getTime(),
        encryptedContentKey: license.encrypted_key,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[verify-license] Error:', error);
    return new Response(
      JSON.stringify({ canPlay: false, reason: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
