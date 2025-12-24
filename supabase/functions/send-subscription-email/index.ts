import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to?: string;
  type: "payment_confirmation" | "renewal_reminder" | "expiration_warning" | "subscription_cancelled" | "welcome" | "custom" | "support_reply" | "creator-welcome" | "creator-content-submitted" | "creator-content-approved" | "creator-content-rejected" | "creator-kyc-submitted" | "creator-kyc-approved" | "creator-kyc-declined";
  data?: {
    userName?: string;
    amount?: number;
    currency?: string;
    planType?: string;
    expiryDate?: string;
    daysUntilExpiry?: number;
    customSubject?: string;
    customMessage?: string;
    ticketSubject?: string;
    replyMessage?: string;
    contentTitle?: string;
    rejectionReason?: string;
  };
  skipPreferenceCheck?: boolean;
  creatorId?: string;
  rejectionReason?: string;
}

// Get preference field based on email type
function getPreferenceField(type: EmailRequest["type"]): string | null {
  switch (type) {
    case "renewal_reminder":
    case "expiration_warning":
    case "subscription_cancelled":
      return "subscription_reminders";
    case "payment_confirmation":
    case "welcome":
    case "support_reply":
      return null; // Always send these
    case "custom":
      return "promotional";
    default:
      return null;
  }
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
      <img src="https://hoyeeh-videos.sfo3.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png" width="150" height="auto" alt="Hoyeeh" style="margin: 0 auto;">
    </div>
    
    <!-- Content -->
    <div style="background-color: #141414; border-radius: 12px; padding: 32px;">
      \${content}
    </div>
    
    <!-- Footer -->
    <hr style="border-color: #333; margin: 32px 0;">
    <div style="text-align: center;">
      <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">
        © \${new Date().getFullYear()} Hoyeeh. All rights reserved.
      </p>
      <p style="color: #666; font-size: 12px; margin: 0;">
        <a href="https://hoyeeh.com" style="color: #ff6300; text-decoration: none;">Visit Hoyeeh</a>
        &bull;
        <a href="https://hoyeeh.com/subscription" style="color: #ff6300; text-decoration: none;">Manage Subscription</a>
        &bull;
        <a href="https://hoyeeh.com/notifications" style="color: #ff6300; text-decoration: none;">Email Preferences</a>
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

function getEmailContent(type: EmailRequest["type"], data: NonNullable<EmailRequest["data"]>) {
  const { 
    userName = "Valued Customer", 
    amount = 0, 
    currency = "XAF", 
    planType = "Monthly", 
    expiryDate = "", 
    daysUntilExpiry = 0,
    customSubject = "",
    customMessage = "",
    ticketSubject = "",
    replyMessage = "",
    contentTitle = "",
    rejectionReason = ""
  } = data || {};

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
        <a href="https://hoyeeh.com" style="${styles.button}">Start Watching Now</a>
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
        <a href="https://hoyeeh.com/subscription" style="${styles.button}">Manage Subscription</a>
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
        <a href="https://hoyeeh.com/subscription" style="${styles.button}">Renew Now</a>
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
        <a href="https://hoyeeh.com/subscription" style="${styles.button}">Resubscribe</a>
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
        <a href="https://hoyeeh.com" style="${styles.button}">Start Exploring</a>
        <p style="${styles.muted}">Questions? We're here to help at support@hoyeeh.com</p>
      `, "Welcome to Hoyeeh");
      break;

    case "custom":
      const processedMessage = customMessage.replace(/{userName}/g, userName);
      subject = customSubject || "Message from Hoyeeh";
      html = emailWrapper(`
        <h1 style="${styles.heading}">Hello ${userName}!</h1>
        <div style="${styles.text}">
          ${processedMessage.split('\n').map((line: string) => `<p style="margin: 8px 0;">${line}</p>`).join('')}
        </div>
        <p style="${styles.muted}">If you have any questions, please contact us at support@hoyeeh.com</p>
      `, subject);
      break;

    case "support_reply":
      subject = `Re: ${ticketSubject} - Hoyeeh Support`;
      html = emailWrapper(`
        <h1 style="${styles.heading}">Support Reply</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Our support team has replied to your ticket:</p>
        <div style="${styles.infoBoxBorder}">
          <p style="color: #888; font-size: 12px; margin: 0 0 8px 0;"><strong>Ticket:</strong> ${ticketSubject}</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 0; white-space: pre-wrap;">${replyMessage}</p>
        </div>
        <p style="${styles.text}">You can reply to this message in the app.</p>
        <a href="https://hoyeeh.com" style="${styles.button}">View Conversation</a>
        <p style="${styles.muted}">Thank you for contacting Hoyeeh Support!</p>
      `, "Support Reply");
      break;

    case "creator-welcome":
      subject = "Welcome to the Hoyeeh Creator Program! 🎬";
      html = emailWrapper(`
        <h1 style="${styles.heading}">Welcome to the Creator Program!</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Congratulations! Your creator application has been approved. You're now part of the Hoyeeh creator community.</p>
        <div style="${styles.infoBox}">
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Next Steps:</strong></p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">1. Complete your KYC verification to enable payouts</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">2. Upload your first content</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">3. Set your pricing and start earning</p>
        </div>
        <a href="https://hoyeeh.com/creator" style="${styles.button}">Go to Creator Dashboard</a>
      `, "Welcome to Creator Program");
      break;

    case "creator-content-submitted":
      subject = "Content Submitted for Review - Hoyeeh";
      html = emailWrapper(`
        <h1 style="${styles.heading}">Content Submitted</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Your content "<strong>${contentTitle || 'Untitled'}</strong>" has been submitted for review.</p>
        <div style="${styles.infoBox}">
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>What happens next:</strong></p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">• Our team will review your content within 24-48 hours</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">• You'll receive an email once it's approved or if changes are needed</p>
        </div>
        <a href="https://hoyeeh.com/creator" style="${styles.button}">View Submission Status</a>
      `, "Content Submitted");
      break;

    case "creator-content-approved":
      subject = "🎉 Your Content is Now Live! - Hoyeeh";
      html = emailWrapper(`
        <h1 style="${styles.heading}">Content Approved!</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Great news! Your content "<strong>${contentTitle || 'Untitled'}</strong>" has been approved and is now live on Hoyeeh.</p>
        <div style="${styles.infoBox}">
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">Your content is now available to all Hoyeeh users. Start sharing to maximize your earnings!</p>
        </div>
        <a href="https://hoyeeh.com/creator" style="${styles.button}">View Your Content</a>
      `, "Content Approved");
      break;

    case "creator-content-rejected":
      subject = "Content Review Update - Hoyeeh";
      html = emailWrapper(`
        <h1 style="${styles.heading}">Content Review Update</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Unfortunately, your content "<strong>${contentTitle || 'Untitled'}</strong>" was not approved at this time.</p>
        <div style="${styles.infoBoxBorder}">
          <p style="color: #888; font-size: 12px; margin: 0 0 8px 0;"><strong>Reason:</strong></p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 0;">${rejectionReason || 'Please review our content guidelines and try again.'}</p>
        </div>
        <p style="${styles.text}">You can make the necessary changes and resubmit your content.</p>
        <a href="https://hoyeeh.com/creator" style="${styles.button}">Edit & Resubmit</a>
      `, "Content Not Approved");
      break;

    case "creator-kyc-submitted":
      subject = "KYC Verification Submitted - Hoyeeh";
      html = emailWrapper(`
        <h1 style="${styles.heading}">KYC Verification Submitted</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Thank you for submitting your KYC verification documents.</p>
        <div style="${styles.infoBox}">
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>What happens next:</strong></p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">• Our team will verify your documents within 1-3 business days</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">• You'll receive an email once verification is complete</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">• Once approved, you can request payouts</p>
        </div>
        <a href="https://hoyeeh.com/creator" style="${styles.button}">View KYC Status</a>
      `, "KYC Submitted");
      break;

    case "creator-kyc-approved":
      subject = "✅ KYC Verified - Payouts Enabled! - Hoyeeh";
      html = emailWrapper(`
        <h1 style="${styles.heading}">KYC Verification Approved!</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Your KYC verification has been approved. You can now request payouts for your earnings!</p>
        <div style="${styles.infoBox}">
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;"><strong>Next Steps:</strong></p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">• Go to your Creator Dashboard</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">• Navigate to the Payouts tab</p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 8px 0;">• Request a payout (minimum 5,000 XAF)</p>
        </div>
        <a href="https://hoyeeh.com/creator" style="${styles.button}">Request Payout</a>
      `, "KYC Approved");
      break;

    case "creator-kyc-declined":
      subject = "KYC Verification Update - Hoyeeh";
      html = emailWrapper(`
        <h1 style="${styles.heading}">KYC Verification Update</h1>
        <p style="${styles.text}">Hello <span style="${styles.highlight}">${userName}</span>,</p>
        <p style="${styles.text}">Unfortunately, we couldn't verify your KYC documents at this time.</p>
        <div style="${styles.infoBoxBorder}">
          <p style="color: #888; font-size: 12px; margin: 0 0 8px 0;"><strong>Reason:</strong></p>
          <p style="color: #e0e0e0; font-size: 14px; margin: 0;">${rejectionReason || 'Please ensure all documents are clear and valid.'}</p>
        </div>
        <p style="${styles.text}">Please review the feedback above and resubmit your documents.</p>
        <a href="https://hoyeeh.com/creator" style="${styles.button}">Resubmit Documents</a>
      `, "KYC Not Approved");
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

    const { to, type, data = {}, skipPreferenceCheck, creatorId, rejectionReason }: EmailRequest = await req.json();

    // Handle creator emails that use creatorId instead of direct email
    let recipientEmail = to;
    let creatorName = data.userName || 'Creator';
    
    if (creatorId && !to) {
      // Fetch creator profile to get email
      const { data: creatorProfile } = await supabase
        .from('creator_profiles')
        .select('user_id, display_name')
        .eq('id', creatorId)
        .single();
      
      if (creatorProfile) {
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const creatorUser = authUsers?.users.find(u => u.id === creatorProfile.user_id);
        recipientEmail = creatorUser?.email;
        creatorName = creatorProfile.display_name || 'Creator';
      }
      
      if (!recipientEmail) {
        return new Response(
          JSON.stringify({ error: 'Could not find creator email' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: 'No recipient email provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Merge rejection reason into data
    const emailData = { ...data, userName: creatorName, rejectionReason: rejectionReason || data.rejectionReason };

    // Check if admin for sending to others
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin && recipientEmail !== user.email) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - can only send to your own email' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user notification preferences unless skipped
    const preferenceField = getPreferenceField(type);
    if (preferenceField && !skipPreferenceCheck) {
      // Find user by email
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const targetUser = authUsers?.users.find(u => u.email === recipientEmail);
      
      if (targetUser) {
        const { data: userPref } = await supabase
          .from('notification_preferences')
          .select(preferenceField)
          .eq('user_id', targetUser.id)
          .single();

        // If user has explicitly opted out, don't send
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prefValue = userPref ? (userPref as any)[preferenceField] : undefined;
        if (prefValue === false) {
          console.log(`User ${recipientEmail} has opted out of ${preferenceField} emails, skipping`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              skipped: true,
              reason: `User has opted out of ${preferenceField} emails`
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    console.log(`Sending ${type} email to ${recipientEmail} by user ${user.id}`);
    const { subject, html } = getEmailContent(type, emailData);

    const emailResponse = await resend.emails.send({
      from: "Hoyeeh <info@hoyeeh.com>",
      to: [recipientEmail],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log email to database for tracking
    try {
      // Find user by email for linking
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const targetUser = authUsers?.users.find(u => u.email === recipientEmail);

      await supabase.from("email_logs").insert({
        message_id: emailResponse.data?.id || null,
        recipient_email: to,
        template_type: type,
        subject: subject,
        status: "sent",
        user_id: targetUser?.id || null,
        metadata: { data },
      });
      console.log("Email logged to database");
    } catch (logError) {
      console.error("Failed to log email:", logError);
      // Don't fail the request if logging fails
    }

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
