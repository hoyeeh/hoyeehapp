import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContentRecommendation {
  id: string;
  title: string;
  thumbnail_url: string | null;
  genre: string | null;
  content_type: string;
  year: number | null;
  rating: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting weekly digest email job...");

    // Get all users who have opted in for weekly digest
    const { data: subscribedUsers, error: prefsError } = await supabaseAdmin
      .from("notification_preferences")
      .select("user_id")
      .eq("weekly_digest", true);

    if (prefsError) {
      console.error("Error fetching notification preferences:", prefsError);
      throw prefsError;
    }

    // If no specific preferences, get all users (default opt-in)
    let targetUserIds: string[] = [];
    
    if (subscribedUsers && subscribedUsers.length > 0) {
      targetUserIds = subscribedUsers.map((u: any) => u.user_id);
    } else {
      // Get all users from profiles if no preferences set
      const { data: allUsers } = await supabaseAdmin
        .from("profiles")
        .select("id");
      targetUserIds = allUsers?.map((u: any) => u.id) || [];
    }

    console.log(`Found ${targetUserIds.length} users for weekly digest`);

    // Get all auth users to get emails
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
      console.error("Error fetching auth users:", authError);
      throw authError;
    }

    // Filter to target users
    const userEmails = authData.users
      .filter(u => targetUserIds.includes(u.id))
      .map(u => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.display_name || u.email?.split("@")[0] || "User"
      }));

    console.log(`Processing ${userEmails.length} users for weekly digest`);

    // Get new releases from last 2 weeks
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data: newReleases } = await supabaseAdmin
      .from("content")
      .select("id, title, thumbnail_url, genre, content_type, year, rating")
      .gte("created_at", twoWeeksAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(6);

    // Get top rated content
    const { data: topRated } = await supabaseAdmin
      .from("content")
      .select("id, title, thumbnail_url, genre, content_type, year, rating")
      .not("rating", "is", null)
      .order("rating", { ascending: false })
      .limit(6);

    // Get popular genres
    const { data: popularContent } = await supabaseAdmin
      .from("content")
      .select("id, title, thumbnail_url, genre, content_type, year, rating")
      .not("view_count", "is", null)
      .order("view_count", { ascending: false })
      .limit(6);

    let emailsSent = 0;
    let errors = 0;

    for (const user of userEmails) {
      if (!user.email) continue;

      // Get user's watch history to personalize recommendations
      const { data: watchHistory } = await supabaseAdmin
        .from("watch_history")
        .select("content:content_id (genre)")
        .eq("user_id", user.id)
        .limit(20);

      // Extract favorite genres
      const genreCounts: Record<string, number> = {};
      watchHistory?.forEach((item: any) => {
        const genre = item.content?.genre;
        if (genre) {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        }
      });

      const favoriteGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre);

      // Get personalized recommendations based on favorite genres
      let personalizedRecs: ContentRecommendation[] = [];
      if (favoriteGenres.length > 0) {
        const { data: genreContent } = await supabaseAdmin
          .from("content")
          .select("id, title, thumbnail_url, genre, content_type, year, rating")
          .in("genre", favoriteGenres)
          .limit(6);
        personalizedRecs = genreContent || [];
      }

      // Generate and send email
      try {
        const emailHtml = generateDigestEmail(
          user.name,
          newReleases || [],
          topRated || [],
          personalizedRecs,
          favoriteGenres
        );

        await resend.emails.send({
          from: "Hoyeeh <info@hoyeeh.com>",
          to: [user.email],
          subject: "🎬 Your Weekly Digest - New Content & Recommendations",
          html: emailHtml,
        });

        emailsSent++;
        console.log(`Sent weekly digest to ${user.email}`);
      } catch (emailError) {
        console.error(`Failed to send digest to ${user.email}:`, emailError);
        errors++;
      }
    }

    // Create in-app notifications for users who received the email
    const notifications = userEmails
      .filter(u => u.email)
      .map(u => ({
        user_id: u.id,
        title: "Weekly Digest Available",
        body: "Check your email for personalized content recommendations!",
        type: "weekly_digest",
      }));

    if (notifications.length > 0) {
      await supabaseAdmin.from("notifications").insert(notifications);
    }

    console.log(`Weekly digest complete: ${emailsSent} sent, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        errors,
        message: `Sent ${emailsSent} weekly digest emails`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in weekly-digest:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateDigestEmail(
  userName: string,
  newReleases: ContentRecommendation[],
  topRated: ContentRecommendation[],
  personalized: ContentRecommendation[],
  favoriteGenres: string[]
): string {
  const generateContentGrid = (items: ContentRecommendation[], title: string) => {
    if (!items || items.length === 0) return "";
    
    const contentCards = items.slice(0, 3).map(item => `
      <td style="width: 33%; padding: 8px; vertical-align: top;">
        <a href="https://hoyeeh.com/content/${item.id}" style="text-decoration: none; color: inherit;">
          <div style="background: #1a1a1a; border-radius: 8px; overflow: hidden;">
            <img src="${item.thumbnail_url || 'https://via.placeholder.com/150x225?text=No+Image'}" 
                 alt="${item.title}" 
                 style="width: 100%; height: 140px; object-fit: cover;">
            <div style="padding: 10px;">
              <p style="margin: 0; font-size: 12px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${item.title}
              </p>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #888;">
                ${item.genre || ''} ${item.rating ? `• ⭐ ${item.rating}` : ''}
              </p>
            </div>
          </div>
        </a>
      </td>
    `).join('');

    return `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #ff6300; margin: 0 0 15px 0; font-size: 18px;">${title}</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>${contentCards}</tr>
        </table>
      </div>
    `;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="text-align: center; padding: 30px 0;">
          <p style="color: #ff6300; font-size: 36px; font-weight: 700; margin: 0; letter-spacing: -1px;">Hoyeeh</p>
        </div>

        <!-- Main Content -->
        <div style="background: #141414; border-radius: 16px; padding: 30px; margin-bottom: 20px;">
          <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 24px;">
            Hey ${userName}! 👋
          </h1>
          <p style="color: #a0a0a0; margin: 0 0 30px 0; font-size: 16px;">
            Here's your personalized weekly digest with the latest content and recommendations just for you.
          </p>

          ${newReleases.length > 0 ? generateContentGrid(newReleases, "🆕 New Releases") : ""}
          
          ${personalized.length > 0 ? generateContentGrid(personalized, `🎯 Because You Like ${favoriteGenres.slice(0, 2).join(" & ")}`) : ""}
          
          ${topRated.length > 0 ? generateContentGrid(topRated, "⭐ Top Rated") : ""}

          <!-- CTA Button -->
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://hoyeeh.com" 
               style="display: inline-block; background: linear-gradient(135deg, #ff6300 0%, #b64700 100%); 
                      color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; 
                      font-weight: 600; font-size: 16px;">
              Browse All Content
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px 0;">
          <p style="color: #666; font-size: 12px; margin: 0 0 10px 0;">
            You're receiving this because you're subscribed to weekly digest emails.
          </p>
          <p style="color: #666; font-size: 12px; margin: 0;">
            <a href="https://hoyeeh.com/notifications" style="color: #ff6300;">Manage preferences</a>
            &nbsp;•&nbsp;
            <a href="https://hoyeeh.com" style="color: #ff6300;">Visit Hoyeeh</a>
          </p>
          <p style="color: #444; font-size: 11px; margin: 15px 0 0 0;">
            © ${new Date().getFullYear()} Hoyeeh. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
