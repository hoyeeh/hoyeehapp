import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting subscription expiration check...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current date and warning dates
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // Get expiring subscriptions (1 day, 3 days, 7 days before expiry)
    const { data: expiringSubscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("status", "active")
      .gte("expires_at", now.toISOString())
      .lte("expires_at", sevenDaysFromNow.toISOString());

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    console.log(`Found ${expiringSubscriptions?.length || 0} expiring subscriptions`);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    console.log(`Found ${expiringSubscriptions?.length || 0} expiring subscriptions`);

    const emailsSent: string[] = [];
    const notificationsCreated: string[] = [];

    for (const subscription of expiringSubscriptions || []) {
      if (!subscription.expires_at) continue;

      const expiryDate = new Date(subscription.expires_at);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Determine which warning to send based on days until expiry
      let shouldNotify = false;
      let emailType: "expiration_warning" | "renewal_reminder" = "expiration_warning";

      if (daysUntilExpiry === 7) {
        shouldNotify = true;
        emailType = "renewal_reminder";
      } else if (daysUntilExpiry === 3) {
        shouldNotify = true;
        emailType = "expiration_warning";
      } else if (daysUntilExpiry === 1) {
        shouldNotify = true;
        emailType = "expiration_warning";
      }

      if (shouldNotify) {
        // Check if we already sent a notification for this expiry period
        const notificationType = `subscription_expiry_${daysUntilExpiry}d`;
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        
        const { data: existingNotification } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", subscription.user_id)
          .eq("type", notificationType)
          .gte("created_at", todayStart)
          .maybeSingle();

        if (existingNotification) {
          console.log(`Already notified user ${subscription.user_id} for ${daysUntilExpiry}-day expiry today`);
          continue;
        }

        // Get user email from auth.users
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
          subscription.user_id
        );

        if (userError || !userData?.user?.email) {
          console.error(`Could not get email for user ${subscription.user_id}:`, userError);
          continue;
        }

        // Get profile for display name
        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", subscription.user_id)
          .maybeSingle();

        const userEmail = userData.user.email;
        const userName = profileData?.display_name || userEmail.split("@")[0];

        // Create in-app notification
        const notificationTitle = daysUntilExpiry === 1 
          ? "⚠️ Subscription expires tomorrow!" 
          : daysUntilExpiry === 3
            ? "⚠️ Subscription expires in 3 days"
            : "📅 Subscription renews in 7 days";
        
        const notificationBody = daysUntilExpiry <= 3
          ? `Your premium access expires on ${expiryDate.toLocaleDateString()}. Renew now to keep watching your favorite content!`
          : `Your subscription will renew on ${expiryDate.toLocaleDateString()}. Make sure your payment method is up to date.`;

        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: subscription.user_id,
            title: notificationTitle,
            body: notificationBody,
            type: notificationType,
            read: false,
          });

        if (notifError) {
          console.error(`Failed to create notification for user ${subscription.user_id}:`, notifError);
        } else {
          console.log(`Created in-app notification for user ${subscription.user_id} (${daysUntilExpiry} days)`);
          notificationsCreated.push(subscription.user_id);
        }

        // Send email if Resend is configured
        if (RESEND_API_KEY) {
          // Prepare email content
          const emailContent = getEmailContent(emailType, {
            userName,
            amount: subscription.amount,
            currency: subscription.currency,
            planType: subscription.plan_type,
            expiryDate: expiryDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            daysUntilExpiry,
          });

          // Send email via Resend
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Hoyeeh <onboarding@resend.dev>",
              to: [userEmail],
              subject: emailContent.subject,
              html: emailContent.html,
            }),
          });

          if (emailResponse.ok) {
            console.log(`Sent ${emailType} email to ${userEmail} (${daysUntilExpiry} days until expiry)`);
            emailsSent.push(userEmail);
          } else {
            const errorText = await emailResponse.text();
            console.error(`Failed to send email to ${userEmail}:`, errorText);
          }
        }

        // Send push notification
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: subscription.user_id,
              title: notificationTitle,
              body: notificationBody,
              type: "subscription_warning",
            }
          });
        } catch (pushError) {
          console.error("Failed to send push notification:", pushError);
        }
      }
    }

    // Also check for expired subscriptions and update status
    const { data: expiredSubs, error: expiredError } = await supabase
      .from("subscriptions")
      .select("id, user_id")
      .eq("status", "active")
      .lt("expires_at", now.toISOString());

    if (!expiredError && expiredSubs && expiredSubs.length > 0) {
      console.log(`Found ${expiredSubs.length} expired subscriptions to update`);
      
      for (const sub of expiredSubs) {
        // Update subscription status
        await supabase
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("id", sub.id);

        // Update profile subscription status
        await supabase
          .from("profiles")
          .update({ is_subscribed: false })
          .eq("id", sub.user_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: emailsSent.length,
        notificationsCreated: notificationsCreated.length,
        expiredUpdated: expiredSubs?.length || 0,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in subscription check:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

function getEmailContent(
  type: "expiration_warning" | "renewal_reminder",
  data: {
    userName: string;
    amount: number;
    currency: string;
    planType: string;
    expiryDate: string;
    daysUntilExpiry: number;
  }
) {
  const { userName, amount, currency, planType, expiryDate, daysUntilExpiry } = data;

  if (type === "renewal_reminder") {
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
          <p>Make sure your payment method is up to date to continue enjoying Hoyeeh Premium.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://hoyeeh.lovable.app/subscription" style="background-color: #ff6300; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Manage Subscription</a>
          </div>
          <p style="color: #888; font-size: 12px; margin-top: 40px; text-align: center;">© 2024 Hoyeeh. All rights reserved.</p>
        </div>
      `,
    };
  }

  return {
    subject: `⚠️ Your Hoyeeh Subscription Expires in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? "s" : ""}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0a0a0a; color: #ffffff; padding: 40px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ff6300; margin: 0;">HOYEEH</h1>
        </div>
        <h2 style="color: #ff6300;">⚠️ Subscription Expiring Soon!</h2>
        <p>Hello ${userName},</p>
        <p>Your Hoyeeh Premium subscription expires in <strong>${daysUntilExpiry} day${daysUntilExpiry > 1 ? "s" : ""}</strong> on ${expiryDate}.</p>
        <p style="font-size: 18px; color: #ff6300;"><strong>Don't lose access to your favorite premium content!</strong></p>
        <div style="background-color: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff6300;">
          <p style="margin: 5px 0;"><strong>What you'll lose:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Access to all premium movies and series</li>
            <li>HD and 4K streaming quality</li>
            <li>Offline downloads</li>
            <li>Ad-free experience</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://hoyeeh.lovable.app/subscription" style="background-color: #ff6300; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px; display: inline-block;">Renew Now for ${amount?.toLocaleString()} ${currency}</a>
        </div>
        <p style="color: #888;">If you've already renewed, please ignore this email.</p>
        <p style="color: #888; font-size: 12px; margin-top: 40px; text-align: center;">© 2024 Hoyeeh. All rights reserved.</p>
      </div>
    `,
  };
}