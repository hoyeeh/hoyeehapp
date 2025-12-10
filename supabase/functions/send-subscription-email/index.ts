import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  type: "payment_confirmation" | "renewal_reminder" | "expiration_warning" | "subscription_cancelled";
  data: {
    userName?: string;
    amount?: number;
    currency?: string;
    planType?: string;
    expiryDate?: string;
    daysUntilExpiry?: number;
  };
}

const getEmailContent = (type: EmailRequest["type"], data: EmailRequest["data"]) => {
  const { userName = "Valued Customer", amount, currency = "XAF", planType = "Monthly", expiryDate, daysUntilExpiry } = data;

  switch (type) {
    case "payment_confirmation":
      return {
        subject: "Payment Confirmed - Welcome to Hoyeeh Premium!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0a0a0a; color: #ffffff; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #ff6300; margin: 0;">HOYEEH</h1>
            </div>
            <h2 style="color: #ffffff;">Payment Confirmed! 🎉</h2>
            <p>Hello ${userName},</p>
            <p>Thank you for your subscription to Hoyeeh Premium!</p>
            <div style="background-color: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Plan:</strong> ${planType}</p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount?.toLocaleString()} ${currency}</p>
              <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${expiryDate}</p>
            </div>
            <p>You now have unlimited access to all premium content. Enjoy!</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://hoyeeh.lovable.app" style="background-color: #ff6300; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Start Watching</a>
            </div>
            <p style="color: #888; font-size: 12px; margin-top: 40px; text-align: center;">© 2024 Hoyeeh. All rights reserved.</p>
          </div>
        `,
      };

    case "renewal_reminder":
      return {
        subject: `Your Hoyeeh Subscription Renews in ${daysUntilExpiry} Days`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0a0a0a; color: #ffffff; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #ff6300; margin: 0;">HOYEEH</h1>
            </div>
            <h2 style="color: #ffffff;">Subscription Renewal Reminder</h2>
            <p>Hello ${userName},</p>
            <p>Your Hoyeeh Premium subscription will renew in <strong>${daysUntilExpiry} days</strong> on ${expiryDate}.</p>
            <div style="background-color: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Plan:</strong> ${planType}</p>
              <p style="margin: 5px 0;"><strong>Renewal Amount:</strong> ${amount?.toLocaleString()} ${currency}</p>
              <p style="margin: 5px 0;"><strong>Renewal Date:</strong> ${expiryDate}</p>
            </div>
            <p>Your payment method will be charged automatically. No action is needed to continue enjoying Hoyeeh Premium.</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://hoyeeh.lovable.app/subscription" style="background-color: #ff6300; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Manage Subscription</a>
            </div>
            <p style="color: #888; font-size: 12px; margin-top: 40px; text-align: center;">© 2024 Hoyeeh. All rights reserved.</p>
          </div>
        `,
      };

    case "expiration_warning":
      return {
        subject: `⚠️ Your Hoyeeh Subscription Expires in ${daysUntilExpiry} Days!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0a0a0a; color: #ffffff; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #ff6300; margin: 0;">HOYEEH</h1>
            </div>
            <h2 style="color: #ff6300;">Subscription Expiring Soon!</h2>
            <p>Hello ${userName},</p>
            <p>Your Hoyeeh Premium subscription expires in <strong>${daysUntilExpiry} days</strong> on ${expiryDate}.</p>
            <p>Don't lose access to your favorite premium content! Renew now to continue enjoying unlimited streaming.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://hoyeeh.lovable.app/subscription" style="background-color: #ff6300; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Renew Now</a>
            </div>
            <p style="color: #888;">If you've already renewed, please ignore this email.</p>
            <p style="color: #888; font-size: 12px; margin-top: 40px; text-align: center;">© 2024 Hoyeeh. All rights reserved.</p>
          </div>
        `,
      };

    case "subscription_cancelled":
      return {
        subject: "Your Hoyeeh Subscription Has Been Cancelled",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0a0a0a; color: #ffffff; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #ff6300; margin: 0;">HOYEEH</h1>
            </div>
            <h2 style="color: #ffffff;">Subscription Cancelled</h2>
            <p>Hello ${userName},</p>
            <p>We're sorry to see you go. Your Hoyeeh Premium subscription has been cancelled.</p>
            <p>You'll continue to have access until ${expiryDate}.</p>
            <p>We'd love to have you back! You can resubscribe anytime to regain access to all premium content.</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://hoyeeh.lovable.app/subscription" style="background-color: #ff6300; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Resubscribe</a>
            </div>
            <p style="color: #888; font-size: 12px; margin-top: 40px; text-align: center;">© 2024 Hoyeeh. All rights reserved.</p>
          </div>
        `,
      };

    default:
      return {
        subject: "Hoyeeh Notification",
        html: `<p>Hello ${userName}, this is a notification from Hoyeeh.</p>`,
      };
  }
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, type, data }: EmailRequest = await req.json();

    console.log(`Sending ${type} email to ${to}`);

    const { subject, html } = getEmailContent(type, data);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Hoyeeh <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await emailResponse.json();
    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify(result), {
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
