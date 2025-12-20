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

// Check for concurrent streams
const checkConcurrentStreams = (userId: string, contentId: string, sessionToken: string): boolean => {
  let concurrentCount = 0;
  const maxConcurrent = 2; // Allow 2 concurrent streams
  
  for (const [token, session] of activeSessions.entries()) {
    if (session.userId === userId && token !== sessionToken) {
      // Check if session is still active (heartbeat within last 2 minutes)
      if (Date.now() - session.lastHeartbeat < 120000) {
        concurrentCount++;
      } else {
        // Clean up stale session
        activeSessions.delete(token);
      }
    }
  }
  
  return concurrentCount < maxConcurrent;
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
        // Validate session token if provided
        if (sessionToken) {
          const tokenValidation = validateSessionToken(sessionToken);
          if (!tokenValidation.valid) {
            return new Response(
              JSON.stringify({ error: 'Invalid session token' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Check concurrent streams
        if (sessionToken && !checkConcurrentStreams(user.id, contentId, sessionToken)) {
          return new Response(
            JSON.stringify({ 
              error: 'Too many concurrent streams',
              maxConcurrent: 2,
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate license
        const licenseKey = generateLicenseKey(user.id, contentId);
        
        // Store session
        if (sessionToken) {
          activeSessions.set(sessionToken, {
            userId: user.id,
            contentId,
            episodeId,
            createdAt: Date.now(),
            lastHeartbeat: Date.now(),
            deviceFingerprint,
          });
        }

        // Log license acquisition
        console.log(`License acquired: user=${user.id}, content=${contentId}, episode=${episodeId || 'N/A'}`);

        return new Response(
          JSON.stringify({
            success: true,
            licenseKey,
            expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
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
