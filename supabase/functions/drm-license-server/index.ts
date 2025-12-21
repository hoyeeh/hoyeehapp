import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Content key cache (short-lived, OK for in-memory)
const contentKeyCache = new Map<string, {
  keyId: string;
  contentKey: string;
  createdAt: number;
}>();

// Rate limiting (short-lived, OK for in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100;

const isRateLimited = (userId: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || userLimit.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  
  if (userLimit.count >= MAX_REQUESTS) {
    return true;
  }
  
  userLimit.count++;
  return false;
};

// Convert Uint8Array to base64url
const bytesToBase64url = (bytes: Uint8Array): string => {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Derive a deterministic content key from user, content, and secret
const deriveContentKey = async (userId: string, contentId: string): Promise<{ keyId: string; contentKey: string }> => {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'default-secret';
  
  // Check cache first
  const cacheKey = `${userId}:${contentId}`;
  const cached = contentKeyCache.get(cacheKey);
  if (cached && (Date.now() - cached.createdAt) < 3600000) {
    return { keyId: cached.keyId, contentKey: cached.contentKey };
  }
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(`${userId}:${contentId}:${secret}`);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', keyMaterial, keyData);
  const derivedBytes = new Uint8Array(signature.slice(0, 16));
  
  const keyIdData = encoder.encode(`keyid:${contentId}:${secret}`);
  const keyIdSignature = await crypto.subtle.sign('HMAC', keyMaterial, keyIdData);
  const keyIdBytes = new Uint8Array(keyIdSignature.slice(0, 16));
  
  const result = {
    keyId: bytesToBase64url(keyIdBytes),
    contentKey: bytesToBase64url(derivedBytes),
  };
  
  contentKeyCache.set(cacheKey, { ...result, createdAt: Date.now() });
  return result;
};

// Generate license key
const generateLicenseKey = (userId: string, contentId: string): string => {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'default-secret';
  const timestamp = Date.now();
  const data = `${userId}:${contentId}:${timestamp}:${secret}`;
  
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return `LIC-${Math.abs(hash).toString(36)}-${timestamp.toString(36)}`;
};

// Check concurrent streams using database - counts UNIQUE content being watched
const checkConcurrentStreams = async (
  supabase: any, 
  userId: string, 
  contentId: string
): Promise<{ allowed: boolean; existingLicense?: any }> => {
  const maxConcurrent = 2;
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  
  // Check if there's already a valid license for this exact content
  const { data: existingLicense } = await supabase
    .from('download_licenses')
    .select('*')
    .eq('user_id', userId)
    .eq('content_id', contentId)
    .eq('status', 'active')
    .gt('last_verified', twoMinutesAgo)
    .maybeSingle();
  
  if (existingLicense) {
    // Reuse existing license for same content - just update heartbeat
    await supabase
      .from('download_licenses')
      .update({ last_verified: new Date().toISOString() })
      .eq('id', existingLicense.id);
    
    return { allowed: true, existingLicense };
  }
  
  // Count active licenses for DIFFERENT content
  const { count } = await supabase
    .from('download_licenses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('content_id', contentId)
    .gt('last_verified', twoMinutesAgo);
  
  return { allowed: (count || 0) < maxConcurrent };
};

// Create or update license in database
const createOrUpdateLicense = async (
  supabase: any,
  userId: string,
  contentId: string,
  episodeId?: string,
  deviceId?: string
): Promise<string> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours
  const licenseKey = generateLicenseKey(userId, contentId);
  
  // Try to find existing license for this user/content combo
  const { data: existing } = await supabase
    .from('download_licenses')
    .select('id')
    .eq('user_id', userId)
    .eq('content_id', contentId)
    .eq('status', 'active')
    .maybeSingle();
  
  if (existing) {
    // Update existing license
    await supabase
      .from('download_licenses')
      .update({
        last_verified: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        encrypted_key: licenseKey,
      })
      .eq('id', existing.id);
    
    return licenseKey;
  }
  
  // Create new license
  await supabase
    .from('download_licenses')
    .insert({
      user_id: userId,
      content_id: contentId,
      episode_id: episodeId || null,
      device_id: deviceId || 'web-player',
      encrypted_key: licenseKey,
      expires_at: expiresAt.toISOString(),
      status: 'active',
      last_verified: now.toISOString(),
    });
  
  return licenseKey;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    if (isRateLimited(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { contentId, episodeId, action, sessionToken, deviceFingerprint } = body;

    if (!contentId || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check subscription status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_subscribed, subscription_expiry')
      .eq('id', user.id)
      .single();

    const hasValidSubscription = profile?.is_subscribed && 
      (!profile.subscription_expiry || new Date(profile.subscription_expiry) > new Date());

    // Check if content requires subscription
    const { data: content } = await supabase
      .from('content')
      .select('is_premium, title')
      .eq('id', contentId)
      .single();

    if (content?.is_premium && !hasValidSubscription) {
      return new Response(
        JSON.stringify({ error: 'Subscription required for premium content' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'acquire': {
        // Check concurrent streams using database
        const streamCheck = await checkConcurrentStreams(supabase, user.id, contentId);
        
        if (!streamCheck.allowed) {
          console.log(`Concurrent stream limit reached for user=${user.id}`);
          return new Response(
            JSON.stringify({ 
              error: 'Too many concurrent streams',
              maxConcurrent: 2,
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If there's an existing license for this content, return it
        if (streamCheck.existingLicense) {
          console.log(`Reusing existing license for: user=${user.id}, content=${contentId}`);
          
          return new Response(
            JSON.stringify({
              success: true,
              licenseKey: streamCheck.existingLicense.encrypted_key,
              sessionToken: streamCheck.existingLicense.id,
              expiresAt: streamCheck.existingLicense.expires_at,
              securityLevel: 'high',
              contentTitle: content?.title,
              reused: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create new license in database
        const licenseKey = await createOrUpdateLicense(supabase, user.id, contentId, episodeId, deviceFingerprint);
        console.log(`New license acquired: user=${user.id}, content=${contentId}`);

        return new Response(
          JSON.stringify({
            success: true,
            licenseKey,
            expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            securityLevel: 'high',
            contentTitle: content?.title,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'heartbeat': {
        // Update license heartbeat in database
        const { data: license, error: licenseError } = await supabase
          .from('download_licenses')
          .select('id, created_at')
          .eq('user_id', user.id)
          .eq('content_id', contentId)
          .eq('status', 'active')
          .maybeSingle();

        if (!license) {
          return new Response(
            JSON.stringify({ valid: false, error: 'No active license found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase
          .from('download_licenses')
          .update({ last_verified: new Date().toISOString() })
          .eq('id', license.id);

        return new Response(
          JSON.stringify({
            valid: true,
            sessionAge: Date.now() - new Date(license.created_at).getTime(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'revoke': {
        // Mark license as revoked in database
        await supabase
          .from('download_licenses')
          .update({ status: 'revoked' })
          .eq('user_id', user.id)
          .eq('content_id', contentId)
          .eq('status', 'active');
        
        console.log(`License revoked: user=${user.id}, content=${contentId}`);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'validate': {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        const { data: license } = await supabase
          .from('download_licenses')
          .select('id')
          .eq('user_id', user.id)
          .eq('content_id', contentId)
          .eq('status', 'active')
          .gt('last_verified', twoMinutesAgo)
          .maybeSingle();
        
        return new Response(
          JSON.stringify({
            valid: !!license,
            hasSubscription: hasValidSubscription,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-content-key': {
        // Verify user has active license
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        const { data: license } = await supabase
          .from('download_licenses')
          .select('id')
          .eq('user_id', user.id)
          .eq('content_id', contentId)
          .eq('status', 'active')
          .gt('last_verified', twoMinutesAgo)
          .maybeSingle();

        if (!license) {
          return new Response(
            JSON.stringify({ error: 'No active license' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { keyId: derivedKeyId, contentKey } = await deriveContentKey(user.id, contentId);
        console.log(`Content key requested: user=${user.id}, content=${contentId}`);

        return new Response(
          JSON.stringify({
            success: true,
            keyId: derivedKeyId,
            contentKey: contentKey,
            algorithm: 'aes-128-cbc',
            expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-key-info': {
        const { keyId: derivedKeyId } = await deriveContentKey(user.id, contentId);

        return new Response(
          JSON.stringify({
            success: true,
            keyId: derivedKeyId,
            algorithm: 'aes-128-cbc',
            keySystem: 'org.w3.clearkey',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('DRM License Server Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
