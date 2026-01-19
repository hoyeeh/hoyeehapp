import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateUserDetailsRequest {
  targetUserId: string;
  newEmail?: string;
  newPhoneNumber?: string;
}

async function sendDetailsUpdateEmail(
  email: string,
  userName: string,
  changedFields: { field: string; oldValue: string; newValue: string }[]
): Promise<boolean> {
  const displayName = userName || "User";

  const changesHtml = changedFields.map(change => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #333; color: #888;">
        ${change.field}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #333; color: #ef4444; text-decoration: line-through;">
        ${change.oldValue || "Not set"}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #333; color: #22c55e; font-weight: 600;">
        ${change.newValue}
      </td>
    </tr>
  `).join("");

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
              <span style="font-size: 32px;">📝</span>
            </div>
          </div>
          
          <h1 style="color: #3b82f6; font-size: 24px; text-align: center; margin: 0 0 24px 0;">
            Your Account Details Have Been Updated
          </h1>
          
          <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
            Hello ${displayName},
          </p>
          
          <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Your account details have been updated by an administrator. Here are the changes:
          </p>
          
          <table style="width: 100%; border-collapse: collapse; background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #262626;">
                <th style="padding: 12px 16px; text-align: left; color: #888; font-weight: 600;">Field</th>
                <th style="padding: 12px 16px; text-align: left; color: #888; font-weight: 600;">Old Value</th>
                <th style="padding: 12px 16px; text-align: left; color: #888; font-weight: 600;">New Value</th>
              </tr>
            </thead>
            <tbody>
              ${changesHtml}
            </tbody>
          </table>
          
          <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
            <p style="color: #93c5fd; font-size: 14px; margin: 0; font-weight: 600;">
              ℹ️ If you requested these changes, no action is needed.
            </p>
          </div>
          
          <div style="background-color: #3d0a0a; border-left: 4px solid #dc2626; padding: 16px; margin: 24px 0; border-radius: 4px;">
            <p style="color: #fca5a5; font-size: 14px; margin: 0; font-weight: 600;">
              🔒 If you did not request these changes, please contact support immediately at support@hoyeeh.com
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
        from: "Account Updates <info@hoyeeh.com>",
        to: [email],
        subject: "Your Hoyeeh Account Details Have Been Updated",
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Failed to send email:", errorData);
      return false;
    }

    console.log("Details update email sent successfully");
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

    // Create user client to verify the caller
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the calling user
    const { data: { user: callerUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callerUser) {
      console.error("Failed to get caller user:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if caller is admin or super_admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .in("role", ["admin", "super_admin"]);

    if (roleError || !roleData || roleData.length === 0) {
      console.error("Caller is not an admin");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Admin role required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    const { targetUserId, newEmail, newPhoneNumber }: UpdateUserDetailsRequest = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "Target user ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!newEmail && !newPhoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "At least one field to update is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Admin ${callerUser.id} updating details for user ${targetUserId}`);

    // Get target user info
    const { data: { user: targetUser }, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    
    if (targetUserError || !targetUser) {
      console.error("Failed to get target user:", targetUserError);
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get profile data
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("display_name, mobile_number")
      .eq("id", targetUserId)
      .maybeSingle();

    const displayName = profileData?.display_name || targetUser.email?.split("@")[0] || "User";
    const changedFields: { field: string; oldValue: string; newValue: string }[] = [];

    // Update email if provided
    if (newEmail && newEmail !== targetUser.email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid email format" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        email: newEmail,
        email_confirm: true, // Auto-confirm the new email
      });

      if (updateEmailError) {
        console.error("Failed to update email:", updateEmailError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to update email: ${updateEmailError.message}` }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      changedFields.push({
        field: "Email Address",
        oldValue: targetUser.email || "",
        newValue: newEmail,
      });
    }

    // Update phone number if provided
    if (newPhoneNumber !== undefined) {
      const { error: updatePhoneError } = await supabaseAdmin
        .from("profiles")
        .update({ mobile_number: newPhoneNumber || null })
        .eq("id", targetUserId);

      if (updatePhoneError) {
        console.error("Failed to update phone number:", updatePhoneError);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to update phone number: ${updatePhoneError.message}` }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (newPhoneNumber !== profileData?.mobile_number) {
        changedFields.push({
          field: "Phone Number",
          oldValue: profileData?.mobile_number || "",
          newValue: newPhoneNumber || "Removed",
        });
      }
    }

    // Log the action
    await supabaseAdmin.from("audit_logs").insert({
      admin_id: callerUser.id,
      action: "update_user_details",
      resource_type: "user",
      resource_id: targetUserId,
      details: {
        changes: changedFields,
        target_user_id: targetUserId,
        timestamp: new Date().toISOString(),
      },
    });

    // Send notification email to user
    let emailSent = false;
    const emailToNotify = newEmail || targetUser.email;
    if (emailToNotify && changedFields.length > 0) {
      emailSent = await sendDetailsUpdateEmail(emailToNotify, displayName, changedFields);
      
      // If email changed, also notify the old email address
      if (newEmail && targetUser.email && newEmail !== targetUser.email) {
        await sendDetailsUpdateEmail(targetUser.email, displayName, changedFields);
      }
    }

    console.log(`User details updated for ${targetUserId}, email sent: ${emailSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailSent,
        changes: changedFields,
        message: emailSent 
          ? "User details updated and notification sent" 
          : "User details updated. Email notification could not be sent."
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in admin-update-user-details function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
