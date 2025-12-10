import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';
import { PaymentConfirmation } from './_templates/payment-confirmation.tsx';
import { ExpirationWarning } from './_templates/expiration-warning.tsx';
import { RenewalReminder } from './_templates/renewal-reminder.tsx';
import { SubscriptionCancelled } from './_templates/subscription-cancelled.tsx';
import { WelcomeEmail } from './_templates/welcome-email.tsx';
import { BaseEmail, emailStyles } from './_templates/base-email.tsx';

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

// Custom email component
const CustomEmail = ({ userName, message }: { userName: string; message: string }) => {
  // Replace {userName} placeholder in message
  const processedMessage = message.replace(/{userName}/g, userName);
  
  return React.createElement(BaseEmail, { previewText: "Message from Hoyeeh" },
    React.createElement('h1', { style: emailStyles.heading }, `Hello ${userName}!`),
    React.createElement('div', { style: emailStyles.text }, 
      processedMessage.split('\n').map((line: string, i: number) => 
        React.createElement('p', { key: i, style: { margin: '8px 0' } }, line)
      )
    ),
    React.createElement('p', { style: emailStyles.mutedText }, 
      'If you have any questions, please contact us at support@hoyeeh.com'
    )
  );
};

async function getEmailContent(type: EmailRequest["type"], data: EmailRequest["data"]) {
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
      html = await renderAsync(
        React.createElement(PaymentConfirmation, {
          userName,
          amount,
          currency,
          planType,
          expiryDate,
        })
      );
      break;

    case "renewal_reminder":
      subject = `Your Hoyeeh Subscription Renews in ${daysUntilExpiry} Days`;
      html = await renderAsync(
        React.createElement(RenewalReminder, {
          userName,
          amount,
          currency,
          planType,
          expiryDate,
          daysUntilExpiry,
        })
      );
      break;

    case "expiration_warning":
      subject = `⚠️ Your Hoyeeh Subscription Expires in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? "s" : ""}!`;
      html = await renderAsync(
        React.createElement(ExpirationWarning, {
          userName,
          amount,
          currency,
          planType,
          expiryDate,
          daysUntilExpiry,
        })
      );
      break;

    case "subscription_cancelled":
      subject = "Your Hoyeeh Subscription Has Been Cancelled";
      html = await renderAsync(
        React.createElement(SubscriptionCancelled, {
          userName,
          expiryDate,
        })
      );
      break;

    case "welcome":
      subject = "Welcome to Hoyeeh - Your streaming journey begins!";
      html = await renderAsync(
        React.createElement(WelcomeEmail, {
          userName,
        })
      );
      break;

    case "custom":
      subject = customSubject || "Message from Hoyeeh";
      html = await renderAsync(
        React.createElement(CustomEmail, {
          userName,
          message: customMessage,
        })
      );
      break;

    default:
      subject = "Hoyeeh Notification";
      html = `<p>Hello ${userName}, this is a notification from Hoyeeh.</p>`;
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
    const { subject, html } = await getEmailContent(type, data);

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
