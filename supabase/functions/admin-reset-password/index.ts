import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AdminResetPasswordRequest {
  targetUserId: string;
  sendEmail?: boolean;
  customPassword?: string;
}

// Generate a cryptographically secure random password
function secureRandomInt(maxExclusive: number): number {
  // Rejection sampling for unbiased values in [0, maxExclusive)
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % maxExclusive;
  }
}

function pickChar(set: string): string {
  return set[secureRandomInt(set.length)];
}

function secureShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateSecurePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = lowercase + uppercase + numbers + special;

  const chars: string[] = [
    pickChar(lowercase),
    pickChar(uppercase),
    pickChar(numbers),
    pickChar(special),
  ];
  for (let i = chars.length; i < length; i++) {
    chars.push(pickChar(allChars));
  }
  return secureShuffle(chars).join('');
}

async function sendPasswordResetEmail(
  email: string,
  newPassword: string,
  userName?: string
): Promise<boolean> {
  const displayName = userName || "User";

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #0a0a0a;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <p style="color: #ff6300; font-size: 36px; font-weight: 700; margin: 0; letter-spacing: -1px;">Hoyeeh</p>
        </div>
        <div style="background-color: #141414; border-radius: 12px; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background-color: #1e3a5f; border-radius: 50%; padding: 16px;">
              <span style="font-size: 32px;">🔑</span>
            </div>
          </div>
          
          <h1 style="color: #3b82f6; font-size: 24px; text-align: center; margin: 0 0 24px 0;">
            Your Password Has Been Reset
          </h1>
          
          <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            Hello ${displayName},
          </p>
          
          <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            Your account password has been reset by an administrator. Here is your new temporary password:
          </p>
          
          <div style="background-color: #1a1a1a; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
            <p style="color: #3b82f6; font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 2px; font-family: monospace;">
              ${newPassword}
            </p>
          </div>
          
          <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
            <p style="color: #93c5fd; font-size: 14px; margin: 0; font-weight: 600;">
              ⚠️ Important: Please change this password immediately after logging in for security purposes.
            </p>
          </div>
          
          <div style="background-color: #3d0a0a; border-left: 4px solid #dc2626; padding: 16px; margin: 24px 0; border-radius: 4px;">
            <p style="color: #fca5a5; font-size: 14px; margin: 0; font-weight: 600;">
              🔒 If you did not request this password reset, please contact support immediately.
            </p>
          </div>
          
          <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
            This is an automated security notification. Please do not reply to this email.
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; margin-top: 20px;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Hoyeeh. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Security <onboarding@resend.dev>",
        to: [email],
        subject: "Your Hoyeeh Password Has Been Reset",
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Failed to send email:", errorData);
      return false;
    }

    console.log("Password reset email sent successfully");
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create user client to verify the caller (use ANON key so JWT is validated against the user, not service role)
    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get the calling user (pass token explicitly — no persisted session in edge functions)
    const { data: { user: callerUser }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !callerUser) {
      console.error("Failed to get caller user:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if caller is super_admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Caller is not a super admin");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Super Admin role required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    const { targetUserId, sendEmail = true, customPassword }: AdminResetPasswordRequest = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Target user ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate custom password if supplied
    if (customPassword !== undefined && customPassword !== null && customPassword !== "") {
      if (typeof customPassword !== "string" || customPassword.length < 8 || customPassword.length > 72) {
        return new Response(
          JSON.stringify({ success: false, error: "Custom password must be 8-72 characters" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    console.log(`Super admin ${callerUser.id} resetting password for user ${targetUserId}`);

    // Rate limiting: Check recent password resets by this admin
    const { count: recentResets } = await supabaseAdmin
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("admin_id", callerUser.id)
      .eq("action", "reset_password")
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (recentResets && recentResets >= 10) {
      console.error("Rate limit exceeded for password resets");
      return new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded: Maximum 10 password resets per hour" }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get target user info
    const { data: { user: targetUser }, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    
    if (targetUserError || !targetUser) {
      console.error("Failed to get target user:", targetUserError);
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get display name from profiles
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", targetUserId)
      .maybeSingle();

    const displayName = profileData?.display_name || targetUser.email?.split("@")[0] || "User";

    // Use supplied custom password or generate a secure one
    const isCustom = !!(customPassword && customPassword.length >= 8);
    const newPassword = isCustom ? customPassword! : generateSecurePassword(16);

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to reset password" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log the action (never log the password itself)
    await supabaseAdmin.from("audit_logs").insert({
      admin_id: callerUser.id,
      action: "reset_password",
      resource_type: "user",
      resource_id: targetUserId,
      details: {
        action: isCustom ? "password_set_custom" : "password_reset",
        target_user_id: targetUserId,
        target_email: targetUser.email,
        email_sent: sendEmail,
        timestamp: new Date().toISOString(),
      },
    });

    // Send email with new password if requested
    let emailSent = false;
    if (sendEmail && targetUser.email) {
      emailSent = await sendPasswordResetEmail(targetUser.email, newPassword, displayName);
    }

    console.log(`Password reset successful for user ${targetUserId}, email sent: ${emailSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailSent,
        userEmail: targetUser.email,
        message: emailSent 
          ? "Password reset and email sent successfully" 
          : "Password reset successful. Email notification could not be sent."
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in admin-reset-password function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
