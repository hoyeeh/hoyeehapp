import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LoginRequest {
  mobileNumber?: string;
  pin?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as LoginRequest;
    const mobileNumber = (body.mobileNumber || "").trim();
    const pin = (body.pin || "").trim();

    if (!/^\+?[0-9]{10,15}$/.test(mobileNumber.replace(/\s/g, "")) || !/^\d{6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "Invalid mobile number or PIN" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify PIN using existing secure SECURITY DEFINER RPC
    const { data: verifyRows, error: verifyError } = await admin.rpc("verify_pin_code", {
      user_mobile: mobileNumber,
      input_pin: pin,
    });
    if (verifyError) {
      console.error("verify_pin_code error:", verifyError);
      return new Response(
        JSON.stringify({ error: "Verification failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const result = Array.isArray(verifyRows) ? verifyRows[0] : verifyRows;

    if (result?.is_locked) {
      return new Response(
        JSON.stringify({ error: "Account locked. Try again later.", locked: true }),
        { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!result?.user_id || !result?.is_valid) {
      return new Response(
        JSON.stringify({ error: "Invalid mobile number or PIN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user's email so we can mint a magiclink they can verify
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(result.user_id);
    if (userErr || !userData?.user?.email) {
      console.error("getUserById error:", userErr);
      return new Response(
        JSON.stringify({ error: "Account email missing. Contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const email = userData.user.email;

    // Generate a magiclink and return the verification hashed_token to the client.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("generateLink error:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        email,
        token_hash: linkData.properties.hashed_token,
        type: "magiclink",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("pin-login error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
