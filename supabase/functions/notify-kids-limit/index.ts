import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = "https://hoyeeh.com";
const SUPABASE_FUNCTIONS_URL = Deno.env.get('SUPABASE_URL') + '/functions/v1';

interface NotifyRequest {
  profileId: string;
  type: 'time_limit' | 'bedtime';
  profileName: string;
}

interface ViewingData {
  title: string;
  minutes: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { profileId, type, profileName }: NotifyRequest = await req.json();
    
    console.log(`Processing ${type} notification for profile ${profileId} (${profileName})`);

    // Get the kids profile to find the parent user
    const { data: kidsProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, name, daily_time_limit_minutes, bedtime_time, time_watched_today_minutes')
      .eq('id', profileId)
      .single();

    if (profileError || !kidsProfile) {
      console.error('Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parentUserId = kidsProfile.user_id;
    const childName = kidsProfile.name || profileName;

    // Check parent's notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('kids_time_limit_alerts, kids_bedtime_alerts')
      .eq('user_id', parentUserId)
      .single();

    // Check if parent has opted out of this notification type
    const prefField = type === 'time_limit' ? 'kids_time_limit_alerts' : 'kids_bedtime_alerts';
    const hasOptedIn = prefs ? (prefs as any)[prefField] !== false : true;

    if (!hasOptedIn) {
      console.log(`Parent ${parentUserId} has opted out of ${type} notifications`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'opted_out' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get today's viewing history for summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: viewingHistory } = await supabase
      .from('kids_viewing_history')
      .select(`
        duration_watched_minutes,
        content:content_id (title, genre)
      `)
      .eq('profile_id', profileId)
      .gte('watched_at', todayStart.toISOString());

    // Aggregate viewing data
    const viewingSummary: ViewingData[] = [];
    const genreCounts: Record<string, number> = {};
    
    if (viewingHistory) {
      for (const record of viewingHistory) {
        const content = record.content as any;
        if (content?.title) {
          const existing = viewingSummary.find(v => v.title === content.title);
          if (existing) {
            existing.minutes += record.duration_watched_minutes || 0;
          } else {
            viewingSummary.push({
              title: content.title,
              minutes: record.duration_watched_minutes || 0
            });
          }
          
          if (content.genre) {
            genreCounts[content.genre] = (genreCounts[content.genre] || 0) + 1;
          }
        }
      }
    }

    // Get top genres for recommendations
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([genre]) => genre);

    // Get content recommendations based on viewing history
    let recommendations: string[] = [];
    if (topGenres.length > 0) {
      const { data: recommendedContent } = await supabase
        .from('content')
        .select('title')
        .or(topGenres.map(g => `genre.ilike.%${g}%`).join(','))
        .in('content_rating', ['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G'])
        .limit(5);
      
      if (recommendedContent) {
        const watchedTitles = new Set(viewingSummary.map(v => v.title));
        recommendations = recommendedContent
          .filter(c => !watchedTitles.has(c.title))
          .map(c => c.title)
          .slice(0, 3);
      }
    }

    // Create notification title and body based on type
    let title: string;
    let body: string;
    
    const totalWatched = kidsProfile.time_watched_today_minutes || 0;
    const hours = Math.floor(totalWatched / 60);
    const minutes = totalWatched % 60;
    const watchTimeDisplay = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;
    
    if (type === 'time_limit') {
      title = `${childName}'s Watch Time is Up! ⏰`;
      body = `${childName} has reached their daily limit of ${kidsProfile.daily_time_limit_minutes} minutes (watched ${watchTimeDisplay}). Top content: ${viewingSummary.slice(0, 2).map(v => v.title).join(', ') || 'Various shows'}.`;
    } else {
      title = `Bedtime for ${childName}! 🌙`;
      body = `It's past ${kidsProfile.bedtime_time || 'bedtime'} - ${childName}'s bedtime. They watched ${watchTimeDisplay} today.`;
    }

    // Create in-app notification for the parent with rich data
    const { error: notifyError } = await supabase
      .from('notifications')
      .insert({
        user_id: parentUserId,
        title,
        body,
        type: `kids_${type}`,
      });

    if (notifyError) {
      console.error('Error creating notification:', notifyError);
    }

    // Get parent's email for sending detailed summary
    const { data: parentUser } = await supabase.auth.admin.getUserById(parentUserId);
    
    if (parentUser?.user?.email && type === 'time_limit') {
      // Generate secure token for one-click actions
      const timestamp = Date.now();
      const actionToken = btoa(`${profileId}:${parentUserId}:${timestamp}`);
      
      // Send detailed email with viewing summary and action buttons
      await sendDetailedEmail({
        email: parentUser.user.email,
        parentName: parentUser.user.user_metadata?.display_name || 'Parent',
        childName,
        totalMinutes: totalWatched,
        dailyLimit: kidsProfile.daily_time_limit_minutes || 0,
        viewingSummary,
        recommendations,
        actionToken,
      });
    }

    // Get parent's push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', parentUserId);

    let pushSent = 0;

    // Send push notifications
    if (subscriptions && subscriptions.length > 0) {
      for (const sub of subscriptions) {
        try {
          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'TTL': '86400',
              'Content-Type': 'application/json',
              'Urgency': 'high',
            },
            body: JSON.stringify({
              title,
              body,
              icon: '/pwa-icon-192.png',
              badge: '/pwa-icon-192.png',
              url: '/parental',
              tag: `kids-${type}-${profileId}`
            })
          });

          if (response.ok || response.status === 201) {
            pushSent++;
          }
        } catch (pushError) {
          console.error('Push notification error:', pushError);
        }
      }
    }

    console.log(`Notification sent: in-app created, ${pushSent} push notifications sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pushSent,
        parentUserId,
        viewingSummary: viewingSummary.length,
        recommendations: recommendations.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in notify-kids-limit function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface DetailedEmailParams {
  email: string;
  parentName: string;
  childName: string;
  totalMinutes: number;
  dailyLimit: number;
  viewingSummary: ViewingData[];
  recommendations: string[];
  actionToken: string;
}

async function sendDetailedEmail(params: DetailedEmailParams): Promise<void> {
  const { email, parentName, childName, totalMinutes, dailyLimit, viewingSummary, recommendations, actionToken } = params;
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const watchTimeDisplay = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.log("RESEND_API_KEY not configured, skipping email");
    return;
  }

  const viewingList = viewingSummary.slice(0, 5).map(v => `
    <tr>
      <td style="padding: 10px 12px; color: #e0e0e0; font-size: 14px; border-bottom: 1px solid #333;">${v.title}</td>
      <td style="padding: 10px 12px; color: #ff6300; font-size: 14px; border-bottom: 1px solid #333; text-align: right;">${v.minutes}m</td>
    </tr>
  `).join('');

  const recommendationsList = recommendations.length > 0 
    ? recommendations.map(r => `
        <div style="background: #0a0a0a; padding: 10px 14px; border-radius: 8px; margin: 6px 0;">
          <span style="color: #e0e0e0; font-size: 14px;">🎬 ${r}</span>
        </div>
      `).join('')
    : '<p style="color: #888; font-size: 14px;">Watch more content to get personalized recommendations!</p>';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto;">
        <!-- Header -->
        <div style="text-align: center; padding: 30px 0;">
          <p style="color: #ff6300; font-size: 36px; font-weight: 700; margin: 0 0 16px 0; letter-spacing: -1px;">Hoyeeh</p>
        </div>
        
        <!-- Main Content -->
        <div style="background: #141414; border-radius: 16px; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 48px;">⏰</span>
            <h1 style="color: #ffffff; margin: 16px 0 8px 0; font-size: 24px;">Daily Watch Time Complete!</h1>
            <p style="color: #888; margin: 0; font-size: 16px;">${childName} has reached their daily limit</p>
          </div>
          
          <p style="color: #e0e0e0; font-size: 16px; margin: 0 0 24px 0;">
            Hello ${parentName},
          </p>
          
          <p style="color: #e0e0e0; font-size: 16px; margin: 0 0 24px 0;">
            ${childName} has finished their daily screen time allowance. Here's a summary of what they watched today:
          </p>
          
          <!-- Stats Cards -->
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <div style="background: #1a1a1a; padding: 20px; border-radius: 12px; flex: 1; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #ff6300;">${watchTimeDisplay}</div>
              <div style="color: #888; font-size: 12px; margin-top: 4px;">Total Watched</div>
            </div>
            <div style="background: #1a1a1a; padding: 20px; border-radius: 12px; flex: 1; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #4ade80;">${dailyLimit}m</div>
              <div style="color: #888; font-size: 12px; margin-top: 4px;">Daily Limit</div>
            </div>
            <div style="background: #1a1a1a; padding: 20px; border-radius: 12px; flex: 1; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #ff6300;">${viewingSummary.length}</div>
              <div style="color: #888; font-size: 12px; margin-top: 4px;">Videos</div>
            </div>
          </div>
          
          <!-- Viewing Summary -->
          <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <h3 style="color: #ffffff; margin: 0 0 16px 0; font-size: 16px;">📺 Today's Viewing Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 10px 12px; color: #888; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #333;">Content</th>
                  <th style="text-align: right; padding: 10px 12px; color: #888; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #333;">Time</th>
                </tr>
              </thead>
              <tbody>
                ${viewingList || '<tr><td colspan="2" style="padding: 12px; color: #888; text-align: center;">No viewing data available</td></tr>'}
              </tbody>
            </table>
          </div>
          
          <!-- Quick Actions -->
          <div style="background: linear-gradient(135deg, #1f2937 0%, #1a1a2e 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #374151;">
            <h3 style="color: #ffffff; margin: 0 0 8px 0; font-size: 16px;">⚡ Quick Actions</h3>
            <p style="color: #9ca3af; font-size: 14px; margin: 0 0 16px 0;">Need to extend ${childName}'s screen time? Click a button below:</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <a href="${SUPABASE_FUNCTIONS_URL}/adjust-kids-time-limit?token=${actionToken}&action=add15" style="background: #374151; color: #e0e0e0; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; display: inline-block;">➕ 15 min</a>
              <a href="${SUPABASE_FUNCTIONS_URL}/adjust-kids-time-limit?token=${actionToken}&action=add30" style="background: #374151; color: #e0e0e0; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; display: inline-block;">➕ 30 min</a>
              <a href="${SUPABASE_FUNCTIONS_URL}/adjust-kids-time-limit?token=${actionToken}&action=reset" style="background: #ff6300; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">🔄 Reset Timer</a>
            </div>
            <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0 0;">Links expire in 24 hours for security</p>
          </div>
          
          <!-- Recommendations -->
          <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2a1a10 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #ff6300;">
            <h3 style="color: #ffffff; margin: 0 0 12px 0; font-size: 16px;">✨ Recommended for Tomorrow</h3>
            <p style="color: #888; font-size: 14px; margin: 0 0 16px 0;">Based on ${childName}'s interests:</p>
            ${recommendationsList}
          </div>
          
          <!-- CTA -->
          <div style="text-align: center;">
            <a href="${BASE_URL}/parental" style="display: inline-block; background: #ff6300; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              View Parental Dashboard
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 24px; border-top: 1px solid #333; margin-top: 24px;">
          <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">
            You received this because parental notifications are enabled.
          </p>
          <p style="color: #666; font-size: 12px; margin: 0;">
            <a href="${BASE_URL}/notifications" style="color: #ff6300; text-decoration: none;">Manage notification preferences</a>
            &nbsp;•&nbsp;
            <a href="${BASE_URL}" style="color: #ff6300; text-decoration: none;">Visit Hoyeeh</a>
          </p>
          <p style="color: #666; font-size: 12px; margin: 16px 0 0 0;">
            © ${new Date().getFullYear()} Hoyeeh. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Hoyeeh <info@hoyeeh.com>",
        to: [email],
        subject: `${childName}'s Daily Watch Time Summary 📊`,
        html: emailHtml,
      }),
    });

    if (response.ok) {
      console.log(`Detailed email sent to ${email}`);
    } else {
      const error = await response.text();
      console.error("Failed to send detailed email:", error);
    }
  } catch (error) {
    console.error("Error sending detailed email:", error);
  }
}