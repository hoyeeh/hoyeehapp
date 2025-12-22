import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ComingSoonItem {
  id: string;
  title: string;
  tmdb_id: number | null;
  content_type: string;
  thumbnail_url?: string;
  description?: string;
}

interface ContentItem {
  id: string;
  title: string;
  tmdb_id: number | null;
  content_type: string;
  thumbnail_url?: string;
  description?: string;
}

interface MatchedItem {
  comingSoon: ComingSoonItem;
  content: ContentItem;
}

// Branded email template for Coming Soon releases
function getComingSoonEmailHtml({
  userName,
  contentTitle,
  contentType,
  contentId,
  thumbnailUrl,
  description,
}: {
  userName?: string;
  contentTitle: string;
  contentType: string;
  contentId: string;
  thumbnailUrl?: string;
  description?: string;
}): string {
  const watchUrl = `https://hoyeeh.com/content/${contentId}`;
  const contentTypeLabel = contentType === 'series' ? 'Series' : 'Movie';
  const truncatedDescription = description && description.length > 200 
    ? `${description.slice(0, 200)}...` 
    : description;
  const greeting = userName ? `Hey ${userName}! ` : '';

  const thumbnailSection = thumbnailUrl ? `
    <a href="${watchUrl}" style="display: block; margin-bottom: 24px; border-radius: 8px; overflow: hidden;">
      <img src="${thumbnailUrl}" alt="${contentTitle}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px;">
    </a>
  ` : '';

  const descriptionSection = truncatedDescription ? `
    <p style="color: #999; font-size: 14px; line-height: 22px; margin: 0 0 20px 0; text-align: center;">
      ${truncatedDescription}
    </p>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${contentTitle} is now available!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="https://hoyeeh-videos.sfo3.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png" width="150" height="auto" alt="Hoyeeh" style="margin: 0 auto;">
    </div>
    
    <!-- Content -->
    <div style="background-color: #141414; border-radius: 12px; padding: 32px;">
      <!-- Now Available Badge -->
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="background-color: #ff6300; color: #ffffff; font-size: 14px; font-weight: 700; padding: 8px 16px; border-radius: 20px; display: inline-block;">
          🎉 NOW AVAILABLE!
        </span>
      </div>

      ${thumbnailSection}

      <!-- Content Title -->
      <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        ${contentTitle}
      </h1>
      
      <!-- Content Type -->
      <p style="color: #ff6300; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0; text-align: center;">
        ${contentTypeLabel}
      </p>

      ${descriptionSection}

      <!-- Message -->
      <p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 24px 0; text-align: center;">
        ${greeting}The wait is over! The content you've been eagerly waiting for is now available to stream on Hoyeeh.
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${watchUrl}" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px;">
          🎬 Watch Now
        </a>
      </div>

      <!-- Info Note -->
      <p style="color: #666; font-size: 12px; text-align: center; margin: 0; font-style: italic;">
        You received this email because you added "${contentTitle}" to your Coming Soon watchlist.
      </p>
    </div>
    
    <!-- Footer -->
    <hr style="border-color: #333; margin: 32px 0;">
    <div style="text-align: center;">
      <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">
        © ${new Date().getFullYear()} Hoyeeh. All rights reserved.
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
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[sync-coming-soon] Starting sync process...");

    // Step 1: Fetch all active coming_soon items
    const { data: comingSoonItems, error: comingSoonError } = await supabase
      .from("coming_soon")
      .select("id, title, tmdb_id, content_type, thumbnail_url, description")
      .eq("is_active", true);

    if (comingSoonError) {
      console.error("[sync-coming-soon] Error fetching coming_soon:", comingSoonError);
      throw comingSoonError;
    }

    if (!comingSoonItems || comingSoonItems.length === 0) {
      console.log("[sync-coming-soon] No active coming soon items to sync");
      return new Response(
        JSON.stringify({ success: true, message: "No items to sync", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-coming-soon] Found ${comingSoonItems.length} coming soon items to check`);

    // Step 2: Fetch all content items
    const { data: contentItems, error: contentError } = await supabase
      .from("content")
      .select("id, title, tmdb_id, content_type, thumbnail_url, description");

    if (contentError) {
      console.error("[sync-coming-soon] Error fetching content:", contentError);
      throw contentError;
    }

    // Step 3: Find matches
    const matches: MatchedItem[] = [];

    for (const comingSoon of comingSoonItems) {
      // Priority 1: Match by tmdb_id
      if (comingSoon.tmdb_id) {
        const matchByTmdb = contentItems?.find(
          (content) => content.tmdb_id === comingSoon.tmdb_id
        );
        if (matchByTmdb) {
          matches.push({ comingSoon, content: matchByTmdb });
          continue;
        }
      }

      // Priority 2: Match by title + content_type (case-insensitive)
      const matchByTitle = contentItems?.find(
        (content) =>
          content.title.toLowerCase() === comingSoon.title.toLowerCase() &&
          content.content_type === comingSoon.content_type
      );
      if (matchByTitle) {
        matches.push({ comingSoon, content: matchByTitle });
      }
    }

    console.log(`[sync-coming-soon] Found ${matches.length} matches`);

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No matches found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Process each match
    let totalNotified = 0;
    let totalPushSent = 0;
    let totalEmailsSent = 0;
    const processedItems: string[] = [];

    for (const match of matches) {
      const { comingSoon, content } = match;
      console.log(`[sync-coming-soon] Processing match: "${comingSoon.title}" -> Content ID: ${content.id}`);

      // Get users from watchlist for this coming_soon item
      const { data: watchlistUsers, error: watchlistError } = await supabase
        .from("coming_soon_watchlist")
        .select("user_id")
        .eq("coming_soon_id", comingSoon.id);

      if (watchlistError) {
        console.error(`[sync-coming-soon] Error fetching watchlist for ${comingSoon.id}:`, watchlistError);
        continue;
      }

      const userIds = watchlistUsers?.map((w) => w.user_id) || [];
      console.log(`[sync-coming-soon] Found ${userIds.length} users in watchlist for "${comingSoon.title}"`);

      let usersNotifiedForThisItem = 0;

      if (userIds.length > 0) {
        // Get notification preferences for these users
        const { data: preferences, error: prefError } = await supabase
          .from("notification_preferences")
          .select("user_id, coming_soon_alerts")
          .in("user_id", userIds);

        if (prefError) {
          console.error("[sync-coming-soon] Error fetching preferences:", prefError);
        }

        // Filter users who have opted in for coming_soon_alerts
        const optedInUsers = userIds.filter((userId) => {
          const pref = preferences?.find((p) => p.user_id === userId);
          return !pref || pref.coming_soon_alerts !== false;
        });

        console.log(`[sync-coming-soon] ${optedInUsers.length} users opted in for notifications`);

        // Create in-app notifications
        if (optedInUsers.length > 0) {
          const notifications = optedInUsers.map((userId) => ({
            user_id: userId,
            title: "Now Available!",
            body: `"${comingSoon.title}" is now available to watch!`,
            type: "coming_soon_release",
            content_id: content.id,
          }));

          const { error: notifError } = await supabase
            .from("notifications")
            .insert(notifications);

          if (notifError) {
            console.error("[sync-coming-soon] Error creating notifications:", notifError);
          } else {
            totalNotified += optedInUsers.length;
            usersNotifiedForThisItem = optedInUsers.length;
            console.log(`[sync-coming-soon] Created ${optedInUsers.length} in-app notifications`);
          }

          // Send push notifications if VAPID keys are configured
          if (vapidPublicKey && vapidPrivateKey) {
            // Get push subscriptions for opted-in users
            const { data: pushSubs, error: pushSubsError } = await supabase
              .from("push_subscriptions")
              .select("user_id, endpoint, p256dh, auth")
              .in("user_id", optedInUsers);

            if (pushSubsError) {
              console.error("[sync-coming-soon] Error fetching push subscriptions:", pushSubsError);
            } else if (pushSubs && pushSubs.length > 0) {
              console.log(`[sync-coming-soon] Sending ${pushSubs.length} push notifications`);
              
              // Send push notifications using web-push
              const webPush = await import("https://esm.sh/web-push@3.6.7");
              
              webPush.setVapidDetails(
                "mailto:notifications@hoyeeh.com",
                vapidPublicKey,
                vapidPrivateKey
              );

              for (const sub of pushSubs) {
                try {
                  await webPush.sendNotification(
                    {
                      endpoint: sub.endpoint,
                      keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                      },
                    },
                    JSON.stringify({
                      title: "🎬 Now Available!",
                      body: `"${comingSoon.title}" is now available to watch!`,
                      url: `/content/${content.id}`,
                    })
                  );
                  totalPushSent++;
                } catch (pushError) {
                  console.error(`[sync-coming-soon] Push error for ${sub.user_id}:`, pushError);
                }
              }
              console.log(`[sync-coming-soon] Sent ${totalPushSent} push notifications`);
            }
          }

          // Send email notifications if Resend is configured
          if (resendApiKey) {
            try {
              // Get user emails
              const { data: authData } = await supabase.auth.admin.listUsers();
              const usersWithEmails = authData?.users?.filter((u) =>
                optedInUsers.includes(u.id) && u.email
              ) || [];

              // Get user display names from profiles
              const { data: profiles } = await supabase
                .from("profiles_safe")
                .select("id, display_name")
                .in("id", optedInUsers);

              for (const user of usersWithEmails) {
                try {
                  // Get user's display name
                  const userProfile = profiles?.find((p) => p.id === user.id);
                  const userName = userProfile?.display_name || user.user_metadata?.display_name;

                  // Use content thumbnail, fallback to coming soon thumbnail
                  const thumbnailUrl = content.thumbnail_url || comingSoon.thumbnail_url;
                  const description = content.description || comingSoon.description;

                  // Render the branded email template
                  const emailHtml = getComingSoonEmailHtml({
                    userName,
                    contentTitle: comingSoon.title,
                    contentType: comingSoon.content_type,
                    contentId: content.id,
                    thumbnailUrl,
                    description,
                  });

                  const emailResponse = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${resendApiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      from: "Hoyeeh <notifications@hoyeeh.com>",
                      to: [user.email],
                      subject: `🎬 "${comingSoon.title}" is now available!`,
                      html: emailHtml,
                    }),
                  });

                  if (emailResponse.ok) {
                    totalEmailsSent++;
                    console.log(`[sync-coming-soon] Email sent to ${user.email} for "${comingSoon.title}"`);
                  } else {
                    const errorText = await emailResponse.text();
                    console.error(`[sync-coming-soon] Failed to send email to ${user.email}: ${errorText}`);
                  }
                } catch (emailError) {
                  console.error(`[sync-coming-soon] Email error for ${user.email}:`, emailError);
                }
              }
              console.log(`[sync-coming-soon] Sent ${totalEmailsSent} branded email notifications for "${comingSoon.title}"`);
            } catch (emailBatchError) {
              console.error("[sync-coming-soon] Error sending emails:", emailBatchError);
            }
          }
        }
      }

      // Log to sync history
      const { error: logError } = await supabase
        .from("coming_soon_sync_log")
        .insert({
          title: comingSoon.title,
          content_type: comingSoon.content_type,
          content_id: content.id,
          tmdb_id: comingSoon.tmdb_id,
          users_notified: usersNotifiedForThisItem,
        });

      if (logError) {
        console.error(`[sync-coming-soon] Error logging sync for ${comingSoon.title}:`, logError);
      }

      // Delete from coming_soon
      const { error: deleteError } = await supabase
        .from("coming_soon")
        .delete()
        .eq("id", comingSoon.id);

      if (deleteError) {
        console.error(`[sync-coming-soon] Error deleting coming_soon ${comingSoon.id}:`, deleteError);
      } else {
        console.log(`[sync-coming-soon] Removed "${comingSoon.title}" from coming soon`);
        processedItems.push(comingSoon.title);
      }

      // Clean up watchlist entries
      const { error: watchlistDeleteError } = await supabase
        .from("coming_soon_watchlist")
        .delete()
        .eq("coming_soon_id", comingSoon.id);

      if (watchlistDeleteError) {
        console.error(`[sync-coming-soon] Error cleaning watchlist for ${comingSoon.id}:`, watchlistDeleteError);
      }
    }

    console.log(`[sync-coming-soon] Sync complete. Processed ${processedItems.length} items, notified ${totalNotified} users, sent ${totalPushSent} push, ${totalEmailsSent} emails`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedItems.length,
        notified: totalNotified,
        pushSent: totalPushSent,
        emailsSent: totalEmailsSent,
        items: processedItems,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sync-coming-soon] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
