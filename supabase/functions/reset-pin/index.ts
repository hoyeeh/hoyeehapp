import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 attempts per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mobileNumber, secretWord, newPin } = await req.json();

    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitKey = `${clientIP}:${mobileNumber || 'unknown'}`;

    // Check rate limit
    if (!checkRateLimit(rateLimitKey)) {
      console.log(`Rate limit exceeded for ${rateLimitKey}`);
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate inputs
    if (!mobileNumber || !secretWord || !newPin) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(newPin)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be exactly 6 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call the secure database function
    const { data, error } = await supabase
      .rpc('reset_pin_secure', {
        user_mobile: mobileNumber,
        input_secret: secretWord.toLowerCase(),
        new_pin: newPin
      });

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'An error occurred. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = data?.[0];
    
    if (!result?.success) {
      console.log('PIN reset failed:', result?.error_message);
      return new Response(
        JSON.stringify({ error: result?.error_message || 'Invalid credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('PIN reset successful for mobile:', mobileNumber);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in reset-pin function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'An error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
