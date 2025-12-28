import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AdminActionNotificationRequest {
  email: string;
  actionType: "pin_reset" | "secret_reset";
  userName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, actionType, userName }: AdminActionNotificationRequest = await req.json();

    if (!email || !actionType) {
      console.error("Missing required fields: email or actionType");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending ${actionType} notification to ${email}`);

    const actionMessages = {
      pin_reset: {
        subject: "Security Alert: Your PIN Has Been Reset",
        heading: "Your PIN Has Been Reset",
        message: "Your account PIN has been reset by an administrator. You will need to set a new PIN when you next log in.",
        warning: "If you did not request this change, please contact support immediately."
      },
      secret_reset: {
        subject: "Security Alert: Your Secret Word Has Been Changed",
        heading: "Your Secret Word Has Been Changed",
        message: "Your account secret word has been changed by an administrator. This word is used to recover your PIN if you forget it.",
        warning: "If you did not request this change, please contact support immediately."
      }
    };

    const actionInfo = actionMessages[actionType];
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
              <div style="display: inline-block; background-color: #3d0a0a; border-radius: 50%; padding: 16px;">
                <span style="font-size: 32px;">🔒</span>
              </div>
            </div>
            
            <h1 style="color: #dc2626; font-size: 24px; text-align: center; margin: 0 0 24px 0;">
              ${actionInfo.heading}
            </h1>
            
            <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Hello ${displayName},
            </p>
            
            <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              ${actionInfo.message}
            </p>
            
            <div style="background-color: #3d0a0a; border-left: 4px solid #dc2626; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #fca5a5; font-size: 14px; margin: 0; font-weight: 600;">
                ⚠️ ${actionInfo.warning}
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

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Security <onboarding@resend.dev>",
        to: [email],
        subject: actionInfo.subject,
        html: emailHtml,
      }),
    });

    const responseData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Failed to send email:", responseData);
      throw new Error(responseData.message || "Failed to send email");
    }

    console.log("Email sent successfully:", responseData);

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-admin-action-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
