import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SupportReplyRequest {
  userId: string;
  userName: string;
  ticketSubject: string;
  replyMessage: string;
}

const styles = {
  heading: 'color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;',
  text: 'color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;',
  highlight: 'color: #ff6300; font-weight: 600;',
  infoBoxBorder: 'background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #ff6300;',
  button: 'display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;',
  muted: 'color: #888; font-size: 14px; margin: 16px 0 0 0;',
};

const emailWrapper = (content: string, previewText: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${previewText}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="https://hoyeeh.sgp1.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png" width="150" height="auto" alt="Hoyeeh" style="margin: 0 auto;">
    </div>
    
    <!-- Content -->
    <div style="background-color: #141414; border-radius: 12px; padding: 32px;">
      ${content}
    </div>
    
    <!-- Footer -->
    <hr style="border-color: #333; margin: 32px 0;">
    <div style="text-align: center;">
      <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">
        © ${new Date().getFullYear()} Hoyeeh. All rights reserved.
      </p>
      <p style="color: #666; font-size: 12px; margin: 0;">
        <a href="https://hoyeeh.lovable.app" style="color: #ff6300; text-decoration: none;">Visit Hoyeeh</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if sender is admin
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, userName, ticketSubject, replyMessage }: SupportReplyRequest = await req.json();

    // Get user email using admin API
    const { data: { user: targetUser }, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !targetUser?.email) {
      console.log("Could not get user email:", userError);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'User email not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending support reply email to ${targetUser.email}`);

    const subject = `Re: ${ticketSubject} - Hoyeeh Support`;
    const html = emailWrapper(`
      <h1 style="${styles.heading}">Support Reply</h1>
      <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
      <p style="${styles.text}">Our support team has replied to your ticket:</p>
      <div style="${styles.infoBoxBorder}">
        <p style="color: #888; font-size: 12px; margin: 0 0 8px 0;"><strong>Ticket:</strong> ${ticketSubject}</p>
        <p style="color: #e0e0e0; font-size: 14px; margin: 0; white-space: pre-wrap;">${replyMessage}</p>
      </div>
      <p style="${styles.text}">You can reply to this message in the app.</p>
      <a href="https://hoyeeh.lovable.app" style="${styles.button}">View Conversation</a>
      <p style="${styles.muted}">Thank you for contacting Hoyeeh Support!</p>
    `, "Support Reply");

    const emailResponse = await resend.emails.send({
      from: "Hoyeeh Support <support@hoyeeh.com>",
      to: [targetUser.email],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending support reply email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
