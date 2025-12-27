import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const validateMobileNumber = (mobile: string): boolean => {
  if (!mobile || typeof mobile !== 'string') return false;
  const cleaned = mobile.replace(/\s/g, '');
  return /^\+?[0-9]{10,15}$/.test(cleaned);
};

const validatePin = (pin: string): boolean => {
  if (!pin || typeof pin !== 'string') return false;
  return /^\d{6}$/.test(pin);
};

const validateSecretWord = (word: string): boolean => {
  if (!word || typeof word !== 'string') return false;
  const trimmed = word.trim();
  return trimmed.length >= 4 && trimmed.length <= 100;
};

const validateName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
};

// Sanitize display name to prevent XSS
const sanitizeName = (name: string): string => {
  return name.trim().replace(/[<>"\\'`;]/g, '').slice(0, 100);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from auth header
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { mobileNumber, pin, secretWord, displayName } = body as Record<string, unknown>;

    // Validate all inputs
    if (!validateMobileNumber(mobileNumber as string)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mobile number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validatePin(pin as string)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be exactly 6 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateSecretWord(secretWord as string)) {
      return new Response(
        JSON.stringify({ error: 'Secret word must be between 4 and 100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateName(displayName as string)) {
      return new Response(
        JSON.stringify({ error: 'Name must be between 2 and 100 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if mobile already exists for another user
    const { data: existingMobile } = await supabase
      .from('profiles')
      .select('id')
      .eq('mobile_number', mobileNumber as string)
      .neq('id', user.id)
      .maybeSingle();

    if (existingMobile) {
      return new Response(
        JSON.stringify({ error: 'This mobile number is already registered' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize name
    const sanitizedName = sanitizeName(displayName as string);

    // Update profile - the database trigger will hash PIN and secret word
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        mobile_number: (mobileNumber as string).replace(/\s/g, ''),
        pin_code: pin as string,
        secret_word: (secretWord as string).toLowerCase().trim(),
        display_name: sanitizedName,
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user profile in user_profiles table if not exists
    const { error: userProfileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        name: sanitizedName,
        is_kids: false,
      }, {
        onConflict: 'user_id'
      });

    if (userProfileError) {
      console.error('User profile upsert error:', userProfileError);
      // Non-fatal, continue
    }

    console.log('PIN registration successful for user:', user.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Register PIN error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
