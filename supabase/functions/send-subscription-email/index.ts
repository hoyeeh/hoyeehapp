import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  type: "payment_confirmation" | "renewal_reminder" | "expiration_warning" | "subscription_cancelled" | "welcome" | "custom";
  data: {
    userName?: string;
    amount?: number;
    currency?: string;
    planType?: string;
    expiryDate?: string;
    daysUntilExpiry?: number;
    customSubject?: string;
    customMessage?: string;
  };
}

// Email template wrapper
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
        &bull;
        <a href="https://hoyeeh.lovable.app/subscription" style="color: #ff6300; text-decoration: none;">Manage Subscription</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

const styles = {
  heading: 'color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;',
  subheading: 'color: #ff6300; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;',
  text: 'color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;',
  highlight: 'color: #ff6300; font-weight: 600;',
  infoBox: 'background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0;',
  infoBoxBorder: 'background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #ff6300;',
  button: 'display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;',
  muted: 'color: #888; font-size: 14px; margin: 16px 0 0 0;',
};

function getEmailContent(type: EmailRequest["type"], data: EmailRequest["data"]) {
  const { 
    userName = "Valued Customer", 
    amount = 0, 
    currency = "XAF", 
    planType = "Monthly", 
    expiryDate = "", 
    daysUntilExpiry = 0,
    customSubject = "",
    customMessage = ""
  } = data;

  let subject = "";
  let html = "";

  switch (type) {
    case "payment_confirmation":
      subject = "Payment Confirmed - Welcome to Hoyeeh Premium!";
      html = emailWrapper(`
        <h1 style="${styles.heading}">Payment Confirmed!</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Thank you for your payment. Your Hoyeeh Premium subscription is now active!</p>
        <div style="${styles.infoBox}">
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Plan:</strong> ${planType}</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Amount:</strong> ${amount.toLocaleString()} ${currency}</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Valid Until:</strong> ${expiryDate}</p>
        </div>
        <p style="${styles.text}">Enjoy unlimited access to African movies, TV shows, and exclusive content!</p>
        <a href="https://hoyeeh.lovable.app" style="${styles.button}">Start Watching Now</a>
        <p style="${styles.muted}">If you have any questions, contact us at support@hoyeeh.com</p>
      `, "Payment Confirmed");
      break;

    case "renewal_reminder":
      subject = `Your Hoyeeh Subscription Renews in ${daysUntilExpiry} Days`;
      html = emailWrapper(`
        <h1 style="${styles.heading}">Subscription Renewal Reminder</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Your Hoyeeh Premium subscription will automatically renew in <strong>${daysUntilExpiry} days</strong>.</p>
        <div style="${styles.infoBox}">
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Plan:</strong> ${planType}</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Amount:</strong> ${amount.toLocaleString()} ${currency}</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Renewal Date:</strong> ${expiryDate}</p>
        </div>
        <p style="${styles.text}">No action is required. Your subscription will continue seamlessly.</p>
        <a href="https://hoyeeh.lovable.app/subscription" style="${styles.button}">Manage Subscription</a>
        <p style="${styles.muted}">Questions? Contact us at support@hoyeeh.com</p>
      `, "Renewal Reminder");
      break;

    case "expiration_warning":
      subject = `⚠️ Your Hoyeeh Subscription Expires in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? "s" : ""}!`;
      html = emailWrapper(`
        <h1 style="${styles.heading}">⚠️ Subscription Expiring Soon</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Your Hoyeeh Premium subscription will expire in <strong style="color: #ff6300;">${daysUntilExpiry} day${daysUntilExpiry > 1 ? "s" : ""}</strong>.</p>
        <div style="${styles.infoBoxBorder}">
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Expiry Date:</strong> ${expiryDate}</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Current Plan:</strong> ${planType}</p>
        </div>
        <p style="${styles.text}">Don't lose access to your favorite African content! Renew now to continue enjoying:</p>
        <ul style="color: #e0e0e0; font-size: 14px; margin: 12px 0; padding-left: 20px;">
          <li>Unlimited streaming of movies and TV shows</li>
          <li>Exclusive African content</li>
          <li>Watch on any device</li>
          <li>Download for offline viewing</li>
        </ul>
        <a href="https://hoyeeh.lovable.app/subscription" style="${styles.button}">Renew Now</a>
        <p style="${styles.muted}">Need help? Contact support@hoyeeh.com</p>
      `, "Subscription Expiring");
      break;

    case "subscription_cancelled":
      subject = "Your Hoyeeh Subscription Has Been Cancelled";
      html = emailWrapper(`
        <h1 style="${styles.heading}">Subscription Cancelled</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Your Hoyeeh Premium subscription has been cancelled as requested.</p>
        <div style="${styles.infoBox}">
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Access Until:</strong> ${expiryDate}</p>
        </div>
        <p style="${styles.text}">You can continue enjoying premium content until ${expiryDate}. After that, your account will revert to free access.</p>
        <p style="${styles.text}">We'd love to have you back! You can resubscribe anytime to regain full access to our library.</p>
        <a href="https://hoyeeh.lovable.app/subscription" style="${styles.button}">Resubscribe</a>
        <p style="${styles.muted}">Feedback? Let us know at info@hoyeeh.com</p>
      `, "Subscription Cancelled");
      break;

    case "welcome":
      subject = "Welcome to Hoyeeh - Your streaming journey begins!";
      html = emailWrapper(`
        <h1 style="${styles.heading}">Welcome to Hoyeeh! 🎬</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Thank you for joining Hoyeeh - Africa's premier streaming platform!</p>
        <h2 style="${styles.subheading}">What you can do now:</h2>
        <ul style="color: #e0e0e0; font-size: 14px; margin: 12px 0; padding-left: 20px;">
          <li>Browse our collection of African movies and TV shows</li>
          <li>Create up to 5 profiles for your family</li>
          <li>Set up a Kids profile for age-appropriate content</li>
          <li>Subscribe to Premium for unlimited access</li>
        </ul>
        <a href="https://hoyeeh.lovable.app" style="${styles.button}">Start Exploring</a>
        <p style="${styles.muted}">Questions? We're here to help at support@hoyeeh.com</p>
      `, "Welcome to Hoyeeh");
      break;

    case "custom":
      const processedMessage = customMessage.replace(/{userName}/g, userName);
      subject = customSubject || "Message from Hoyeeh";
      html = emailWrapper(`
        <h1 style="${styles.heading}">Hello ${userName}!</h1>
        <div style="${styles.text}">
          ${processedMessage.split('\n').map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
        </div>
        <p style="${styles.muted}">If you have any questions, please contact us at support@hoyeeh.com</p>
      `, subject);
      break;

    default:
      subject = "Hoyeeh Notification";
      html = emailWrapper(`
        <p style="${styles.text}">Hello ${userName}, this is a notification from Hoyeeh.</p>
      `, "Notification");
  }

  return { subject, html };
}

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

    const { to, type, data }: EmailRequest = await req.json();

    // Check if admin for sending to others
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin && to !== user.email) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - can only send to your own email' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending ${type} email to ${to} by user ${user.id}`);
    const { subject, html } = getEmailContent(type, data);

    const emailResponse = await resend.emails.send({
      from: "Hoyeeh <info@hoyeeh.com>",
      to: [to],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
