import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface KidsViewingData {
  profile_name: string;
  total_minutes: number;
  videos_watched: number;
  content_titles: string[];
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

    // Get all users with kids profiles
    const { data: usersWithKids, error: usersError } = await supabaseAdmin
      .from("user_profiles")
      .select(`
        user_id,
        name,
        id
      `)
      .eq("is_kids", true);

    if (usersError) {
      console.error("Error fetching users with kids profiles:", usersError);
      throw usersError;
    }

    if (!usersWithKids || usersWithKids.length === 0) {
      console.log("No kids profiles found");
      return new Response(JSON.stringify({ message: "No kids profiles found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group kids profiles by parent user_id
    const parentKidsMap = new Map<string, { profileId: string; profileName: string }[]>();
    
    for (const profile of usersWithKids) {
      const existing = parentKidsMap.get(profile.user_id) || [];
      existing.push({ profileId: profile.id, profileName: profile.name });
      parentKidsMap.set(profile.user_id, existing);
    }

    // Get viewing history from last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    let emailsSent = 0;

    for (const [userId, kidsProfiles] of parentKidsMap) {
      // Get parent's email
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (userError || !userData?.user?.email) {
        console.error(`Could not get email for user ${userId}:`, userError);
        continue;
      }

      const parentEmail = userData.user.email;
      const kidsViewingData: KidsViewingData[] = [];

      for (const kidProfile of kidsProfiles) {
        // Get viewing history for this profile
        const { data: viewingHistory, error: historyError } = await supabaseAdmin
          .from("kids_viewing_history")
          .select(`
            duration_watched_minutes,
            content:content_id (title)
          `)
          .eq("profile_id", kidProfile.profileId)
          .gte("watched_at", oneWeekAgo.toISOString());

        if (historyError) {
          console.error(`Error fetching viewing history for profile ${kidProfile.profileId}:`, historyError);
          continue;
        }

        const totalMinutes = viewingHistory?.reduce(
          (sum, record) => sum + (record.duration_watched_minutes || 0),
          0
        ) || 0;

        const contentTitles = viewingHistory
          ?.map((record) => (record.content as any)?.title)
          .filter(Boolean) || [];

        const uniqueTitles = [...new Set(contentTitles)];

        kidsViewingData.push({
          profile_name: kidProfile.profileName,
          total_minutes: totalMinutes,
          videos_watched: viewingHistory?.length || 0,
          content_titles: uniqueTitles.slice(0, 10), // Top 10 titles
        });
      }

      if (kidsViewingData.length === 0) continue;

      // Generate email HTML
      const emailHtml = generateEmailHtml(kidsViewingData);

      // Send email
      try {
        await resend.emails.send({
          from: "Hoyeeh <info@hoyeeh.com>",
          to: [parentEmail],
          subject: "Weekly Viewing Report - Your Kids' Activity on Hoyeeh",
          html: emailHtml,
        });
        emailsSent++;
        console.log(`Sent weekly report to ${parentEmail}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${parentEmail}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${emailsSent} weekly viewing reports` 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in weekly-viewing-report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateEmailHtml(kidsData: KidsViewingData[]): string {
  const logoUrl = "https://hoyeeh-videos.sfo3.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png";
  
  const kidsReports = kidsData.map(kid => `
    <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h3 style="color: #ff6300; margin: 0 0 15px 0; font-size: 18px;">
        👶 ${kid.profile_name}'s Activity
      </h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #ff6300;">${Math.round(kid.total_minutes / 60)}</div>
          <div style="color: #666; font-size: 12px;">Hours Watched</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #ff6300;">${kid.videos_watched}</div>
          <div style="color: #666; font-size: 12px;">Videos Watched</div>
        </div>
      </div>
      ${kid.content_titles.length > 0 ? `
        <div style="background: white; padding: 15px; border-radius: 8px;">
          <div style="font-weight: 600; margin-bottom: 10px; color: #333;">Content Watched:</div>
          <ul style="margin: 0; padding-left: 20px; color: #666;">
            ${kid.content_titles.map(title => `<li style="margin-bottom: 5px;">${title}</li>`).join('')}
          </ul>
        </div>
      ` : '<p style="color: #666; margin: 0;">No viewing activity this week.</p>'}
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #ff6300 0%, #b64700 100%); padding: 30px; text-align: center;">
          <img src="${logoUrl}" alt="Hoyeeh" style="height: 50px; margin-bottom: 15px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Weekly Viewing Report</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your kids' activity summary for the past week</p>
        </div>
        
        <div style="padding: 30px;">
          ${kidsReports}
          
          <div style="background: #fff3e6; border-radius: 12px; padding: 20px; margin-top: 20px;">
            <h4 style="color: #ff6300; margin: 0 0 10px 0;">💡 Parenting Tip</h4>
            <p style="color: #666; margin: 0; font-size: 14px;">
              Consider setting daily time limits and bedtime schedules for your kids' profiles to help maintain healthy viewing habits.
            </p>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #999; margin: 0; font-size: 12px;">
            This is an automated weekly report from Hoyeeh.<br>
            © ${new Date().getFullYear()} Hoyeeh. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
