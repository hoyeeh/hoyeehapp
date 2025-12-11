import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { comingSoonId, contentId, title } = await req.json();

    if (!comingSoonId || !title) {
      throw new Error("Missing required parameters: comingSoonId and title");
    }

    console.log(`Processing release notification for: ${title}`);

    // Get all users who added this to their watchlist
    const { data: watchlistUsers, error: watchlistError } = await supabase
      .from("coming_soon_watchlist")
      .select(`
        user_id,
        profiles:user_id (
          id,
          display_name
        )
      `)
      .eq("coming_soon_id", comingSoonId);

    if (watchlistError) {
      console.error("Error fetching watchlist users:", watchlistError);
      throw watchlistError;
    }

    console.log(`Found ${watchlistUsers?.length || 0} users in watchlist`);

    const userIds = watchlistUsers?.map((w: any) => w.user_id) || [];
    
    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No users to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch notification preferences for all users
    const { data: preferences, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id, coming_soon_alerts")
      .in("user_id", userIds);

    if (prefsError) {
      console.error("Error fetching notification preferences:", prefsError);
    }

    // Create a map of user preferences (default to true if no preference set)
    const prefsMap = new Map<string, boolean>();
    preferences?.forEach((p: any) => {
      prefsMap.set(p.user_id, p.coming_soon_alerts);
    });

    // Filter users who have opted in or have no preference (default opt-in)
    const optedInUserIds = userIds.filter(userId => {
      const pref = prefsMap.get(userId);
      return pref === true || pref === undefined;
    });

    console.log(`${optedInUserIds.length} users opted in for coming_soon_alerts`);

    // Fetch user emails for opted-in users
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    const userEmails = authData.users
      .filter(u => optedInUserIds.includes(u.id))
      .map(u => {
        const watchlistEntry = watchlistUsers?.find((w: any) => w.user_id === u.id);
        const profileData = watchlistEntry?.profiles as { display_name?: string } | null;
        return {
          id: u.id,
          email: u.email,
          name: profileData?.display_name || u.email?.split("@")[0]
        };
      });

    // Create in-app notifications only for opted-in users
    const notifications = optedInUserIds.map(userId => ({
      user_id: userId,
      title: "Now Available!",
      body: `"${title}" is now available to watch on Hoyeeh!`,
      type: "release",
      content_id: contentId || null,
    }));

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (notifError) {
      console.error("Error creating notifications:", notifError);
    }

    // Send email notifications if Resend API key is configured
    if (resendApiKey && userEmails.length > 0) {
      console.log(`Sending emails to ${userEmails.length} opted-in users`);

      for (const user of userEmails) {
        if (!user.email) continue;

        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Hoyeeh <notifications@hoyeeh.com>",
              to: user.email,
              subject: `🎬 "${title}" is now available on Hoyeeh!`,
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background-color: #000000; font-family: 'Inter', Arial, sans-serif;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000; padding: 40px 20px;">
                    <tr>
                      <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #0f0f0f 0%, #000000 100%); border-radius: 16px; overflow: hidden;">
                          <!-- Header -->
                          <tr>
                            <td style="padding: 30px; text-align: center; background: linear-gradient(135deg, #ff6300 0%, #b64700 100%);">
                              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">HOYEEH</h1>
                            </td>
                          </tr>
                          
                          <!-- Content -->
                          <tr>
                            <td style="padding: 40px 30px;">
                              <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px;">
                                Hey ${user.name}! 🎉
                              </h2>
                              <p style="margin: 0 0 20px 0; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                                Great news! The content you've been waiting for is now available!
                              </p>
                              <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #ff6300;">
                                <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 20px;">"${title}"</h3>
                                <p style="margin: 0; color: #ff6300; font-size: 14px; font-weight: 600;">NOW STREAMING</p>
                              </div>
                              <p style="margin: 0 0 30px 0; color: #a0a0a0; font-size: 16px; line-height: 1.6;">
                                Start watching now and enjoy the latest entertainment on Hoyeeh.
                              </p>
                              <a href="${Deno.env.get("SITE_URL") || "https://hoyeeh.com"}" 
                                 style="display: inline-block; background: linear-gradient(135deg, #ff6300 0%, #b64700 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                Watch Now
                              </a>
                            </td>
                          </tr>
                          
                          <!-- Footer -->
                          <tr>
                            <td style="padding: 20px 30px; border-top: 1px solid #1a1a1a;">
                              <p style="margin: 0; color: #666666; font-size: 12px; text-align: center;">
                                You're receiving this because you added "${title}" to your coming soon watchlist.
                                <br>
                                <a href="https://hoyeeh.lovable.app/notifications" style="color: #ff6300;">Manage notification preferences</a>
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
              `,
            }),
          });

          if (!emailResponse.ok) {
            const errorData = await emailResponse.text();
            console.error(`Failed to send email to ${user.email}:`, errorData);
          } else {
            console.log(`Email sent to ${user.email}`);
          }
        } catch (emailError) {
          console.error(`Error sending email to ${user.email}:`, emailError);
        }
      }
    }

    // Remove from coming_soon_watchlist after notifications (for all users, not just opted-in)
    const { error: deleteError } = await supabase
      .from("coming_soon_watchlist")
      .delete()
      .eq("coming_soon_id", comingSoonId);

    if (deleteError) {
      console.error("Error cleaning up watchlist:", deleteError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifiedUsers: optedInUserIds.length,
        totalWatchlistUsers: userIds.length,
        message: `Notified ${optedInUserIds.length} of ${userIds.length} users about "${title}" release` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in notify-coming-soon-release:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
