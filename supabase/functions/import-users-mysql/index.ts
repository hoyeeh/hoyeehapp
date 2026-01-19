import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserData {
  email: string;
  display_name?: string;
  mobile_number?: string;
  country?: string;
  password?: string;
  avatar_url?: string;
  is_subscribed?: boolean;
}

interface ImportOptions {
  skipDuplicates: boolean;
  sendWelcomeEmail: boolean;
  requirePasswordReset: boolean;
  defaultPin?: string;
  defaultPassword?: string;
  defaultSecretWord?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callingUser }, error: authError } = await userClient.auth.getUser(token);

    if (authError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id);

    const userRoles = roles?.map(r => r.role) || [];
    if (!userRoles.includes("super_admin") && !userRoles.includes("admin")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin role required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { user, options } = await req.json() as { user: UserData; options: ImportOptions };

    if (!user?.email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format", success: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Importing user: ${user.email}`);

    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === user.email.toLowerCase()
    );

    if (existingUser) {
      if (options.skipDuplicates) {
        return new Response(
          JSON.stringify({ skipped: true, message: "User already exists" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      return new Response(
        JSON.stringify({ error: "User already exists", success: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use default password if provided, otherwise generate one
    const password = options.defaultPassword || user.password || crypto.randomUUID().slice(0, 16) + "Aa1!";

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: user.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        display_name: user.display_name || user.email.split("@")[0],
        imported_from: "mysql"
      }
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message, success: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build profile update data
    const profileData: Record<string, unknown> = {
      display_name: user.display_name || user.email.split("@")[0],
      mobile_number: user.mobile_number || null,
      country: user.country || null,
    };

    // Add avatar_url if provided
    if (user.avatar_url) {
      profileData.avatar_url = user.avatar_url;
    }

    // Add is_subscribed if provided
    if (typeof user.is_subscribed === 'boolean') {
      profileData.is_subscribed = user.is_subscribed;
    }

    // Add default PIN if provided (will be auto-hashed by database trigger)
    if (options.defaultPin) {
      profileData.pin_code = options.defaultPin;
    }

    // Add default secret word if provided (will be auto-hashed by database trigger)
    if (options.defaultSecretWord) {
      profileData.secret_word = options.defaultSecretWord.toLowerCase();
    }

    // Update profile with all data
    const { error: profileError } = await adminClient
      .from("profiles")
      .update(profileData)
      .eq("id", newUser.user.id);

    if (profileError) {
      console.warn("Profile update error:", profileError);
    }

    // Log the import action
    await adminClient.from("audit_logs").insert({
      admin_id: callingUser.id,
      action: "create",
      resource_type: "user",
      resource_id: newUser.user.id,
      details: { 
        action: "user_import", 
        email: user.email,
        source: "mysql",
        has_default_pin: !!options.defaultPin,
        has_default_password: !!options.defaultPassword
      }
    });

    if (options.sendWelcomeEmail) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Hoyeeh <info@hoyeeh.com>",
              to: [user.email],
              subject: "Welcome to Hoyeeh!",
              html: `<div style="font-family:Arial;padding:20px;background:#0a0a0a;"><p style="color:#ff6300;font-size:36px;text-align:center;">Hoyeeh</p><div style="background:#141414;border-radius:12px;padding:32px;"><h1 style="color:#fff;">Welcome!</h1><p style="color:#e0e0e0;">Hello ${user.display_name || user.email.split("@")[0]}, your account has been created.</p><p style="color:#e0e0e0;">Your temporary password is: <strong>${password}</strong></p><p style="color:#e0e0e0;">Please login and change your password.</p></div></div>`,
            }),
          });
        } catch (e) {
          console.warn("Email error:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUser.user.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Import failed" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});