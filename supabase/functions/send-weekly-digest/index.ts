import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContentItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  genre: string | null;
  description: string | null;
  view_count: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[WeeklyDigest] Starting weekly digest generation...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get top 3 movies from the last 7 days based on watch_history
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: topMoviesData, error: moviesError } = await supabase
      .from("watch_history")
      .select(`
        content_id,
        content:content_id (
          id,
          title,
          thumbnail_url,
          genre,
          description,
          content_type
        )
      `)
      .gte("watched_at", sevenDaysAgo.toISOString())
      .not("content", "is", null);

    if (moviesError) {
      console.error("[WeeklyDigest] Error fetching watch history:", moviesError);
      throw moviesError;
    }

    // Aggregate views by content and filter by type
    const contentViews: Record<string, { content: any; views: number }> = {};
    
    for (const entry of topMoviesData || []) {
      const content = entry.content as any;
      if (!content) continue;
      
      if (!contentViews[content.id]) {
        contentViews[content.id] = { content, views: 0 };
      }
      contentViews[content.id].views++;
    }

    // Separate movies and shows
    const movies = Object.values(contentViews)
      .filter(item => item.content.content_type === "movie")
      .sort((a, b) => b.views - a.views)
      .slice(0, 3)
      .map(item => ({ ...item.content, view_count: item.views }));

    const shows = Object.values(contentViews)
      .filter(item => item.content.content_type === "series")
      .sort((a, b) => b.views - a.views)
      .slice(0, 3)
      .map(item => ({ ...item.content, view_count: item.views }));

    console.log(`[WeeklyDigest] Found ${movies.length} top movies and ${shows.length} top shows`);

    // If no content found, skip sending emails
    if (movies.length === 0 && shows.length === 0) {
      console.log("[WeeklyDigest] No trending content found, skipping email send");
      return new Response(
        JSON.stringify({ message: "No trending content to send", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get users who have weekly_digest enabled
    const { data: subscribers, error: subscribersError } = await supabase
      .from("notification_preferences")
      .select(`
        user_id,
        profiles:user_id (
          id,
          display_name
        )
      `)
      .eq("weekly_digest", true);

    if (subscribersError) {
      console.error("[WeeklyDigest] Error fetching subscribers:", subscribersError);
      throw subscribersError;
    }

    // Get emails from auth.users for subscribed users
    const userIds = (subscribers || []).map(s => s.user_id);
    
    if (userIds.length === 0) {
      console.log("[WeeklyDigest] No subscribers found");
      return new Response(
        JSON.stringify({ message: "No subscribers", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use admin API to get user emails
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (usersError) {
      console.error("[WeeklyDigest] Error fetching users:", usersError);
      throw usersError;
    }

    const subscribedUsers = users.filter(u => userIds.includes(u.id) && u.email);
    console.log(`[WeeklyDigest] Sending to ${subscribedUsers.length} subscribers`);

    // Generate email HTML
    const emailHtml = generateEmailHtml(movies, shows);
    
    let successCount = 0;
    let errorCount = 0;

    // Send emails in batches to avoid rate limits
    for (const user of subscribedUsers) {
      try {
        const profile = subscribers?.find(s => s.user_id === user.id)?.profiles as any;
        const displayName = profile?.display_name || "Hoyeeh Viewer";

        const { error: sendError } = await resend.emails.send({
          from: "Hoyeeh <no-reply@hoyeeh.com>",
          to: [user.email!],
          subject: "🎬 This Week's Trending on Hoyeeh",
          html: emailHtml.replace("{{USER_NAME}}", displayName),
        });

        if (sendError) {
          console.error(`[WeeklyDigest] Failed to send to ${user.email}:`, sendError);
          errorCount++;
        } else {
          successCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`[WeeklyDigest] Error sending to ${user.email}:`, err);
        errorCount++;
      }
    }

    console.log(`[WeeklyDigest] Complete: ${successCount} sent, ${errorCount} failed`);

    return new Response(
      JSON.stringify({ 
        message: "Weekly digest sent", 
        sent: successCount, 
        failed: errorCount,
        topMovies: movies.map(m => m.title),
        topShows: shows.map(s => s.title),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[WeeklyDigest] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

function generateEmailHtml(movies: ContentItem[], shows: ContentItem[]): string {
  const appUrl = "https://hoyeeh.com";
  
  const renderContentCard = (item: ContentItem) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #2a2a2a;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="120" style="vertical-align: top;">
              <img 
                src="${item.thumbnail_url || 'https://via.placeholder.com/120x180/1a1a1a/666?text=No+Image'}" 
                alt="${item.title}" 
                width="120" 
                style="border-radius: 8px; display: block;"
              />
            </td>
            <td style="padding-left: 16px; vertical-align: top;">
              <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 18px; font-weight: 600;">
                ${item.title}
              </h3>
              ${item.genre ? `<p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 14px;">${item.genre}</p>` : ''}
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                🔥 ${item.view_count} views this week
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0a0a0a;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px;">
              
              <!-- Header -->
              <tr>
                <td align="center" style="padding-bottom: 32px;">
                  <h1 style="margin: 0; color: #f97316; font-size: 32px; font-weight: bold;">HOYEEH</h1>
                  <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 14px;">Your Weekly Entertainment Digest</p>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding-bottom: 24px;">
                  <p style="margin: 0; color: #ffffff; font-size: 16px;">
                    Hey {{USER_NAME}} 👋
                  </p>
                  <p style="margin: 12px 0 0 0; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                    Here's what the Hoyeeh community has been watching this week. Don't miss out on the trending content!
                  </p>
                </td>
              </tr>
              
              ${movies.length > 0 ? `
              <!-- Top Movies Section -->
              <tr>
                <td style="padding: 24px; background-color: #141414; border-radius: 12px; margin-bottom: 24px;">
                  <h2 style="margin: 0 0 20px 0; color: #f97316; font-size: 20px; font-weight: 600;">
                    🎬 Top Movies This Week
                  </h2>
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    ${movies.map(renderContentCard).join('')}
                  </table>
                </td>
              </tr>
              
              <tr><td style="height: 24px;"></td></tr>
              ` : ''}
              
              ${shows.length > 0 ? `
              <!-- Top Shows Section -->
              <tr>
                <td style="padding: 24px; background-color: #141414; border-radius: 12px;">
                  <h2 style="margin: 0 0 20px 0; color: #8b5cf6; font-size: 20px; font-weight: 600;">
                    📺 Top Shows This Week
                  </h2>
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    ${shows.map(renderContentCard).join('')}
                  </table>
                </td>
              </tr>
              ` : ''}
              
              <!-- CTA Button -->
              <tr>
                <td align="center" style="padding: 32px 0;">
                  <a 
                    href="${appUrl}" 
                    style="display: inline-block; padding: 16px 32px; background-color: #f97316; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;"
                  >
                    Start Watching Now
                  </a>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td align="center" style="padding-top: 32px; border-top: 1px solid #2a2a2a;">
                  <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
                    You're receiving this because you subscribed to weekly digest emails.
                  </p>
                  <p style="margin: 0; color: #6b7280; font-size: 12px;">
                    <a href="${appUrl}/settings" style="color: #f97316; text-decoration: underline;">Manage preferences</a>
                  </p>
                  <p style="margin: 16px 0 0 0; color: #4b5563; font-size: 11px;">
                    © ${new Date().getFullYear()} Hoyeeh. All rights reserved.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

serve(handler);
