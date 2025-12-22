import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL = "https://hoyeeh-videos.sfo3.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png";

interface ContentNotification {
  contentIds: string[];
  categoryName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contentIds, categoryName }: ContentNotification = await req.json();

    console.log(`Notifying parents about ${contentIds.length} new kids content items`);

    // Get content details
    const { data: contents, error: contentError } = await supabase
      .from('content')
      .select('id, title, thumbnail_url, content_type, description')
      .in('id', contentIds);

    if (contentError || !contents?.length) {
      console.error('Content not found:', contentError);
      return new Response(
        JSON.stringify({ error: 'Content not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all unique parent users who have kids profiles
    const { data: kidsProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('is_kids', true);

    if (profilesError) {
      console.error('Error fetching kids profiles:', profilesError);
      throw profilesError;
    }

    const parentUserIds = [...new Set(kidsProfiles?.map(p => p.user_id) || [])];
    console.log(`Found ${parentUserIds.length} parents with kids profiles`);

    if (parentUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get parent emails and notification preferences
    const { data: users } = await supabase.auth.admin.listUsers();
    
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('user_id, new_releases')
      .in('user_id', parentUserIds);

    const prefsMap = new Map<string, boolean>();
    preferences?.forEach(p => prefsMap.set(p.user_id, p.new_releases));

    // Filter to opted-in parents
    const optedInUsers = users?.users?.filter(u => 
      parentUserIds.includes(u.id) && prefsMap.get(u.id) !== false
    ) || [];

    console.log(`${optedInUsers.length} parents opted in for notifications`);

    // Build content HTML
    const contentHtml = contents.map(c => `
      <tr>
        <td style="padding: 15px 0; border-bottom: 1px solid #2a2a2a;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="120" style="vertical-align: top;">
                <img src="${c.thumbnail_url || 'https://via.placeholder.com/120x68'}" 
                     alt="${c.title}" 
                     width="120" 
                     style="border-radius: 8px; display: block;" />
              </td>
              <td style="padding-left: 15px; vertical-align: top;">
                <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                  ${c.title}
                </h3>
                <span style="display: inline-block; padding: 3px 8px; background-color: #ec4899; color: white; font-size: 11px; border-radius: 4px; text-transform: uppercase;">
                  ${c.content_type}
                </span>
                ${c.description ? `
                  <p style="margin: 10px 0 0 0; color: #a0a0a0; font-size: 13px; line-height: 1.4;">
                    ${c.description.substring(0, 100)}${c.description.length > 100 ? '...' : ''}
                  </p>
                ` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `).join('');

    let emailsSent = 0;

    // Send emails using fetch to Resend API
    for (const user of optedInUsers) {
      if (!user.email || !RESEND_API_KEY) continue;

      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0a0a0a;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
                    <tr>
                      <td align="center" style="padding-bottom: 30px;">
                        <img src="${LOGO_URL}" alt="Hoyeeh" width="140" style="display: block;" />
                      </td>
                    </tr>
                    <tr>
                      <td style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0; padding: 30px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                          🎬 New Kids Content! 🌟
                        </h1>
                        <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                          ${categoryName ? `Fresh content added to ${categoryName}` : 'Fresh content for your little ones'}
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #1a1a1a; padding: 30px; border-radius: 0 0 16px 16px;">
                        <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                          Hi there! 👋
                        </p>
                        <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">
                          We've added some exciting new content to the Kids Zone that your children will love! Here's what's new:
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          ${contentHtml}
                        </table>
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 30px;">
                          <tr>
                            <td align="center">
                              <a href="https://hoyeeh.com" 
                                 style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 15px;">
                                Watch Now with Your Kids! 🎉
                              </a>
                            </td>
                          </tr>
                        </table>
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 30px; background-color: #252525; border-radius: 12px;">
                          <tr>
                            <td style="padding: 20px;">
                              <p style="color: #10b981; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                                🛡️ Parental Controls Available
                              </p>
                              <p style="color: #a0a0a0; font-size: 13px; line-height: 1.5; margin: 0;">
                                Remember, you can set daily time limits and bedtime schedules for your kids' profiles.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 30px; text-align: center;">
                        <p style="color: #666666; font-size: 12px; margin: 0;">
                          You received this because you have kids profiles on Hoyeeh.
                          <br>
                          <a href="https://hoyeeh.com/notification-preferences" style="color: #ec4899; text-decoration: none;">Update preferences</a>
                        </p>
                        <p style="color: #444444; font-size: 11px; margin: 20px 0 0 0;">
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

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: "Hoyeeh Kids <kids@hoyeeh.com>",
            to: [user.email],
            subject: `🎉 New Kids Content${categoryName ? ` in ${categoryName}` : ''} on Hoyeeh!`,
            html: emailHtml,
          }),
        });

        if (response.ok) {
          emailsSent++;
          console.log(`Email sent to ${user.email}`);
        } else {
          console.error(`Failed to send email to ${user.email}:`, await response.text());
        }
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
      }
    }

    // Also create in-app notifications
    const notifications = parentUserIds.map(userId => ({
      user_id: userId,
      title: `New Kids Content${categoryName ? ` in ${categoryName}` : ''}! 🎬`,
      body: `${contents.length} new ${contents.length === 1 ? 'title' : 'titles'} added for your kids to enjoy.`,
      type: 'kids_content',
      content_id: contents[0]?.id || null,
    }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    console.log(`Sent ${emailsSent} emails, created ${notifications.length} in-app notifications`);

    return new Response(
      JSON.stringify({ success: true, emailsSent, notificationsCreated: notifications.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in notify-kids-content function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
