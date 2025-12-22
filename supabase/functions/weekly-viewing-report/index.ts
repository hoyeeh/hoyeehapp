import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Consistent logo URL across all emails
const LOGO_URL = "https://hoyeeh-videos.sfo3.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png";

interface KidsViewingData {
  profile_name: string;
  total_minutes: number;
  videos_watched: number;
  content_titles: string[];
  daily_limit_minutes: number | null;
  bedtime_time: string | null;
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

    console.log("[weekly-viewing-report] Starting weekly report generation...");

    // Get all users with kids profiles
    const { data: usersWithKids, error: usersError } = await supabaseAdmin
      .from("user_profiles")
      .select(`
        user_id,
        name,
        id,
        daily_time_limit_minutes,
        bedtime_time
      `)
      .eq("is_kids", true);

    if (usersError) {
      console.error("[weekly-viewing-report] Error fetching users with kids profiles:", usersError);
      throw usersError;
    }

    if (!usersWithKids || usersWithKids.length === 0) {
      console.log("[weekly-viewing-report] No kids profiles found");
      return new Response(JSON.stringify({ message: "No kids profiles found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[weekly-viewing-report] Found ${usersWithKids.length} kids profiles`);

    // Group kids profiles by parent user_id
    const parentKidsMap = new Map<string, { 
      profileId: string; 
      profileName: string;
      dailyLimit: number | null;
      bedtime: string | null;
    }[]>();
    
    for (const profile of usersWithKids) {
      const existing = parentKidsMap.get(profile.user_id) || [];
      existing.push({ 
        profileId: profile.id, 
        profileName: profile.name,
        dailyLimit: profile.daily_time_limit_minutes,
        bedtime: profile.bedtime_time,
      });
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
        console.error(`[weekly-viewing-report] Could not get email for user ${userId}:`, userError);
        continue;
      }

      const parentEmail = userData.user.email;
      const parentName = userData.user.user_metadata?.display_name || "Parent";
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
          console.error(`[weekly-viewing-report] Error fetching viewing history for profile ${kidProfile.profileId}:`, historyError);
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
          daily_limit_minutes: kidProfile.dailyLimit,
          bedtime_time: kidProfile.bedtime,
        });
      }

      if (kidsViewingData.length === 0) continue;

      // Generate email HTML
      const emailHtml = generateEmailHtml(parentName, kidsViewingData);

      // Send email
      try {
        await resend.emails.send({
          from: "Hoyeeh <info@hoyeeh.com>",
          to: [parentEmail],
          subject: "📊 Weekly Viewing Report - Your Kids' Activity on Hoyeeh",
          html: emailHtml,
        });
        emailsSent++;
        console.log(`[weekly-viewing-report] Sent weekly report to ${parentEmail}`);
      } catch (emailError) {
        console.error(`[weekly-viewing-report] Failed to send email to ${parentEmail}:`, emailError);
      }
    }

    console.log(`[weekly-viewing-report] Complete. Sent ${emailsSent} emails`);

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
    console.error("[weekly-viewing-report] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateEmailHtml(parentName: string, kidsData: KidsViewingData[]): string {
  const kidsReports = kidsData.map(kid => {
    const hours = Math.floor(kid.total_minutes / 60);
    const minutes = kid.total_minutes % 60;
    const watchTimeDisplay = hours > 0 
      ? `${hours}h ${minutes}m` 
      : `${minutes}m`;
    
    const dailyAverage = Math.round(kid.total_minutes / 7);
    const limitStatus = kid.daily_limit_minutes 
      ? (dailyAverage <= kid.daily_limit_minutes 
          ? '✅ Within limit' 
          : '⚠️ Exceeded limit')
      : 'No limit set';

    return `
      <div style="background: #1a1a1a; border-radius: 12px; padding: 24px; margin-bottom: 20px; border-left: 4px solid #ff6300;">
        <h3 style="color: #ffffff; margin: 0 0 16px 0; font-size: 20px; display: flex; align-items: center;">
          <span style="font-size: 28px; margin-right: 12px;">👶</span> ${kid.profile_name}'s Activity
        </h3>
        
        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
          <div style="background: #0a0a0a; padding: 16px 20px; border-radius: 10px; flex: 1; min-width: 120px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #ff6300;">${watchTimeDisplay}</div>
            <div style="color: #888; font-size: 12px; margin-top: 4px;">Total Watch Time</div>
          </div>
          <div style="background: #0a0a0a; padding: 16px 20px; border-radius: 10px; flex: 1; min-width: 120px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #ff6300;">${kid.videos_watched}</div>
            <div style="color: #888; font-size: 12px; margin-top: 4px;">Videos Watched</div>
          </div>
          <div style="background: #0a0a0a; padding: 16px 20px; border-radius: 10px; flex: 1; min-width: 120px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #ff6300;">${dailyAverage}m</div>
            <div style="color: #888; font-size: 12px; margin-top: 4px;">Daily Average</div>
          </div>
        </div>
        
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <div style="background: #0a0a0a; padding: 12px 16px; border-radius: 8px; flex: 1;">
            <span style="color: #888; font-size: 12px;">Daily Limit:</span>
            <span style="color: #e0e0e0; font-size: 14px; margin-left: 8px;">
              ${kid.daily_limit_minutes ? `${kid.daily_limit_minutes} min` : 'Not set'}
            </span>
          </div>
          <div style="background: #0a0a0a; padding: 12px 16px; border-radius: 8px; flex: 1;">
            <span style="color: #888; font-size: 12px;">Bedtime:</span>
            <span style="color: #e0e0e0; font-size: 14px; margin-left: 8px;">
              ${kid.bedtime_time || 'Not set'}
            </span>
          </div>
        </div>
        
        <div style="background: ${dailyAverage <= (kid.daily_limit_minutes || 999) ? '#0f3d0f' : '#3d1f0f'}; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px;">
          <span style="color: ${dailyAverage <= (kid.daily_limit_minutes || 999) ? '#4ade80' : '#fbbf24'}; font-size: 14px;">${limitStatus}</span>
        </div>
        
        ${kid.content_titles.length > 0 ? `
          <div>
            <div style="color: #888; font-size: 12px; text-transform: uppercase; margin-bottom: 10px;">Content Watched</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${kid.content_titles.map(title => `
                <span style="background: #0a0a0a; color: #e0e0e0; padding: 6px 12px; border-radius: 20px; font-size: 13px;">
                  ${title}
                </span>
              `).join('')}
            </div>
          </div>
        ` : '<p style="color: #666; margin: 0; font-style: italic;">No viewing activity this week.</p>'}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto;">
        <!-- Header with Logo -->
        <div style="text-align: center; padding: 30px 0;">
          <img src="${LOGO_URL}" alt="Hoyeeh" style="height: 60px; margin-bottom: 20px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Weekly Viewing Report</h1>
          <p style="color: #888; margin: 10px 0 0 0; font-size: 16px;">
            Week of ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        
        <div style="background: #141414; border-radius: 16px; padding: 32px; margin-bottom: 20px;">
          <p style="color: #e0e0e0; font-size: 16px; margin: 0 0 24px 0;">
            Hello ${parentName},
          </p>
          <p style="color: #e0e0e0; font-size: 16px; margin: 0 0 24px 0;">
            Here's a summary of what your kids watched on Hoyeeh this past week:
          </p>
          
          ${kidsReports}
          
          <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin-top: 24px;">
            <h4 style="color: #ff6300; margin: 0 0 12px 0; display: flex; align-items: center;">
              <span style="font-size: 20px; margin-right: 8px;">💡</span> Parenting Tip
            </h4>
            <p style="color: #e0e0e0; margin: 0; font-size: 14px; line-height: 1.6;">
              ${getRandomParentingTip()}
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px;">
          <a href="https://hoyeeh.com" style="display: inline-block; background: #ff6300; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Open Hoyeeh
          </a>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px; border-top: 1px solid #333; margin-top: 20px;">
          <p style="color: #666; margin: 0 0 8px 0; font-size: 12px;">
            This is an automated weekly report from Hoyeeh.
          </p>
          <p style="color: #666; margin: 0; font-size: 12px;">
            © ${new Date().getFullYear()} Hoyeeh. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getRandomParentingTip(): string {
  const tips = [
    "Consider watching content together with your kids to spark conversations about what they're learning.",
    "Setting consistent daily time limits helps establish healthy viewing habits from an early age.",
    "Bedtime mode ensures your kids wind down properly before sleep. Sweet dreams lead to happy mornings!",
    "Encourage your kids to talk about their favorite shows - it helps develop communication skills.",
    "Balance screen time with outdoor activities. Both are important for healthy development.",
    "Watch the first episode of new content together to ensure it's age-appropriate.",
    "Praise your kids for respecting their viewing limits - positive reinforcement works wonders!",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}
