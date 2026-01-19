import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

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
}

interface ImportOptions {
  skipDuplicates: boolean;
  sendWelcomeEmail: boolean;
  requirePasswordReset: boolean;
}

interface ImportRequest {
  user: UserData;
  options: ImportOptions;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client for user creation
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create user client to verify auth
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
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify super admin or admin role
    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id);

    if (rolesError) {
      console.error("Roles error:", rolesError);
      return new Response(
        JSON.stringify({ error: "Failed to verify permissions" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userRoles = roles?.map(r => r.role) || [];
    const isSuperAdmin = userRoles.includes("super_admin");
    const isAdmin = userRoles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin role required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { user, options }: ImportRequest = await req.json();

    if (!user?.email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format", success: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Importing user: ${user.email}`);

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === user.email.toLowerCase()
    );

    if (existingUser) {
      if (options.skipDuplicates) {
        console.log(`Skipping duplicate: ${user.email}`);
        return new Response(
          JSON.stringify({ skipped: true, message: "User already exists" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } else {
        return new Response(
          JSON.stringify({ error: "User already exists", success: false }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Generate a secure password if not provided
    const password = user.password || crypto.randomUUID().slice(0, 16) + "Aa1!";

    // Create the user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: user.email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        display_name: user.display_name || user.email.split("@")[0],
        imported_from: "mysql",
        imported_at: new Date().toISOString()
      }
    });

    if (createError) {
      console.error(`Failed to create user ${user.email}:`, createError);
      return new Response(
        JSON.stringify({ error: createError.message, success: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`User created: ${newUser.user.id}`);

    // Update profile with additional data
    if (user.display_name || user.mobile_number || user.country) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({
          display_name: user.display_name || user.email.split("@")[0],
          mobile_number: user.mobile_number || null,
          country: user.country || null
        })
        .eq("id", newUser.user.id);

      if (profileError) {
        console.warn(`Failed to update profile for ${user.email}:`, profileError);
      }
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
        imported_from: "mysql/phpmyadmin",
        timestamp: new Date().toISOString()
      }
    });

    // Send welcome email if option is enabled
    if (options.sendWelcomeEmail) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
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
              html: `
                <!DOCTYPE html>
                <html>
                <head><meta charset="utf-8"></head>
                <body style="font-family: Arial, sans-serif; margin: 0; padding: 40px 20px; background-color: #0a0a0a;">
                  <div style="max-width: 600px; margin: 0 auto;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <p style="color: #ff6300; font-size: 36px; font-weight: 700; margin: 0;">Hoyeeh</p>
                    </div>
                    <div style="background-color: #141414; border-radius: 12px; padding: 32px;">
                      <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 16px 0;">Welcome to Hoyeeh!</h1>
                      <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                        Hello ${user.display_name || user.email.split("@")[0]},
                      </p>
                      <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6;">
                        Your account has been created. You can now log in and start exploring.
                      </p>
                      ${options.requirePasswordReset ? `
                        <p style="color: #fca5a5; font-size: 14px; margin-top: 24px;">
                          Please reset your password after your first login for security.
                        </p>
                      ` : ''}
                    </div>
                    <div style="text-align: center; padding: 20px;">
                      <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} Hoyeeh. All rights reserved.</p>
                    </div>
                  </div>
                </body>
                </html>
              `,
            }),
          });
          console.log(`Welcome email sent to ${user.email}`);
        }
      } catch (emailError) {
        console.warn(`Failed to send welcome email to ${user.email}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUser.user.id,
        message: "User imported successfully"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Import failed" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
