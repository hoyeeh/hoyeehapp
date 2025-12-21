import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory session store (in production, use Redis or database)
const activeSessions = new Map<string, {
  userId: string;
  contentId: string;
  episodeId?: string;
  createdAt: number;
  lastHeartbeat: number;
  deviceFingerprint?: string;
  keyId?: string;
  contentKey?: string;
}>();

// Content key cache (in production, use secure key management)
const contentKeyCache = new Map<string, {
  keyId: string;
  contentKey: string;
  createdAt: number;
}>();

// Rate limiting
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

// Convert base64url to Uint8Array
const base64urlToBytes = (base64url: string): Uint8Array => {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Generate a secure random key (16 bytes for AES-128)
const generateSecureKey = (): Uint8Array => {
  const key = new Uint8Array(16);
  crypto.getRandomValues(key);
  return key;
};

// Generate a key ID (16 bytes)
const generateKeyId = (): Uint8Array => {
  const keyId = new Uint8Array(16);
  crypto.getRandomValues(keyId);
  return keyId;
};

// Derive a deterministic content key from user, content, and secret
const deriveContentKey = async (userId: string, contentId: string): Promise<{ keyId: string; contentKey: string }> => {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'default-secret';
  
  // Check cache first
  const cacheKey = `${userId}:${contentId}`;
  const cached = contentKeyCache.get(cacheKey);
  if (cached && (Date.now() - cached.createdAt) < 3600000) { // 1 hour cache
    return { keyId: cached.keyId, contentKey: cached.contentKey };
  }
  
  // Generate deterministic key using HMAC
  const encoder = new TextEncoder();
  const keyData = encoder.encode(`${userId}:${contentId}:${secret}`);
  
  // Use crypto.subtle to derive the key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', keyMaterial, keyData);
  const derivedBytes = new Uint8Array(signature.slice(0, 16));
  
  // Generate key ID from content ID
  const keyIdData = encoder.encode(`keyid:${contentId}:${secret}`);
  const keyIdSignature = await crypto.subtle.sign('HMAC', keyMaterial, keyIdData);
  const keyIdBytes = new Uint8Array(keyIdSignature.slice(0, 16));
  
  const result = {
    keyId: bytesToBase64url(keyIdBytes),
    contentKey: bytesToBase64url(derivedBytes),
  };
  
  // Cache the result
  contentKeyCache.set(cacheKey, {
    ...result,
    createdAt: Date.now(),
  });
  
  return result;
};

// Generate license key
const generateLicenseKey = (userId: string, contentId: string): string => {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'default-secret';
  const timestamp = Date.now();
  const data = `${userId}:${contentId}:${timestamp}:${secret}`;
  
  // Simple hash for demo - in production use proper HMAC
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return `LIC-${Math.abs(hash).toString(36)}-${timestamp.toString(36)}`;
};

// Validate session token
const validateSessionToken = (token: string): { valid: boolean; userId?: string; contentId?: string } => {
  try {
    const decoded = atob(token);
    const [userId, timestamp, _random, contentId] = decoded.split(':');
    
    // Check if token is not too old (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return { valid: false };
    }
    
    return { valid: true, userId, contentId };
  } catch {
    return { valid: false };
  }
};

// Check for concurrent streams - allow same content to reuse session
const checkConcurrentStreams = (userId: string, contentId: string, sessionToken: string): { allowed: boolean; existingSession?: string } => {
  let concurrentCount = 0;
  const maxConcurrent = 2; // Allow 2 concurrent streams
  let existingSessionForContent: string | undefined;
  
  // Clean up stale sessions first
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.lastHeartbeat > 120000) {
      activeSessions.delete(token);
    }
  }
  
  for (const [token, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      // Check if there's an existing session for the same content
      if (session.contentId === contentId) {
        existingSessionForContent = token;
        // Update heartbeat on existing session
        session.lastHeartbeat = now;
      } else if (token !== sessionToken) {
        // Only count different content as concurrent
        concurrentCount++;
      }
    }
  }
  
  // If there's an existing session for same content, allow it
  if (existingSessionForContent) {
    return { allowed: true, existingSession: existingSessionForContent };
  }
  
  return { allowed: concurrentCount < maxConcurrent };
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
        // Check concurrent streams (handles session reuse automatically)
        const streamCheck = checkConcurrentStreams(user.id, contentId, sessionToken || '');
        
        if (!streamCheck.allowed) {
          return new Response(
            JSON.stringify({ 
              error: 'Too many concurrent streams',
              maxConcurrent: 2,
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If there's an existing session for this content, return it
        if (streamCheck.existingSession) {
          const existingSession = activeSessions.get(streamCheck.existingSession);
          console.log(`Reusing existing session for: user=${user.id}, content=${contentId}`);
          
          return new Response(
            JSON.stringify({
              success: true,
              licenseKey: generateLicenseKey(user.id, contentId),
              sessionToken: streamCheck.existingSession,
              expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
              securityLevel: 'high',
              contentTitle: content?.title,
              reused: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate new license and session
        const licenseKey = generateLicenseKey(user.id, contentId);
        const newSessionToken = sessionToken || `session-${user.id}-${contentId}-${Date.now()}`;
        
        activeSessions.set(newSessionToken, {
          userId: user.id,
          contentId,
          episodeId,
          createdAt: Date.now(),
          lastHeartbeat: Date.now(),
          deviceFingerprint,
        });

        console.log(`New license acquired: user=${user.id}, content=${contentId}`);

        return new Response(
          JSON.stringify({
            success: true,
            licenseKey,
            sessionToken: newSessionToken,
            expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            securityLevel: 'high',
            contentTitle: content?.title,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'heartbeat': {
        if (!sessionToken) {
          return new Response(
            JSON.stringify({ error: 'Session token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const session = activeSessions.get(sessionToken);
        if (!session || session.userId !== user.id) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Invalid session' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update heartbeat
        session.lastHeartbeat = Date.now();

        return new Response(
          JSON.stringify({
            valid: true,
            sessionAge: Date.now() - session.createdAt,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'revoke': {
        if (sessionToken) {
          activeSessions.delete(sessionToken);
          console.log(`License revoked: user=${user.id}, content=${contentId}`);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'validate': {
        // Validate existing license
        const session = sessionToken ? activeSessions.get(sessionToken) : null;
        
        return new Response(
          JSON.stringify({
            valid: !!session && session.userId === user.id,
            hasSubscription: hasValidSubscription,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-content-key': {
        // Generate content decryption key for Clear Key CDM
        if (!sessionToken) {
          return new Response(
            JSON.stringify({ error: 'Session token required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const session = activeSessions.get(sessionToken);
        if (!session || session.userId !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Invalid session' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Derive content key for this user and content
        const { keyId: derivedKeyId, contentKey } = await deriveContentKey(user.id, contentId);

        // Log key request
        console.log(`Content key requested: user=${user.id}, content=${contentId}, keyId=${derivedKeyId}`);

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
        // Get key information without the actual key (for EME setup)
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
