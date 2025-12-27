import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured, skipping email notifications');
      return new Response(
        JSON.stringify({ success: true, message: 'Email notifications disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    console.log('Checking for content leaving soon in watchlists...');

    // Get content that expires within 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { data: leavingContent, error: contentError } = await supabase
      .from('content')
      .select('id, title, thumbnail_url, expires_at')
      .eq('lifecycle_status', 'leaving_soon')
      .lte('expires_at', sevenDaysFromNow.toISOString())
      .gt('expires_at', new Date().toISOString());

    if (contentError) {
      console.error('Error fetching leaving content:', contentError);
      throw contentError;
    }

    if (!leavingContent || leavingContent.length === 0) {
      console.log('No content leaving soon');
      return new Response(
        JSON.stringify({ success: true, notificationsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${leavingContent.length} titles leaving soon`);

    const contentIds = leavingContent.map(c => c.id);
    let notificationsSent = 0;

    // Find users who have this content in their watchlist (my_list)
    // We need to check the watch_history or a dedicated my_list table
    // For now, let's check notification preferences and series_subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('series_subscriptions')
      .select('user_id, content_id')
      .in('content_id', contentIds);

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
    }

    // Group by user
    const userContentMap = new Map<string, string[]>();
    
    for (const sub of subscriptions || []) {
      if (!userContentMap.has(sub.user_id)) {
        userContentMap.set(sub.user_id, []);
      }
      userContentMap.get(sub.user_id)!.push(sub.content_id);
    }

    // Also check watch_history for users who have watched this content recently
    const { data: watchlistItems, error: watchlistError } = await supabase
      .from('watch_history')
      .select('user_id, content_id')
      .in('content_id', contentIds)
      .gte('last_watched', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (!watchlistError && watchlistItems) {
      for (const item of watchlistItems) {
        if (!userContentMap.has(item.user_id)) {
          userContentMap.set(item.user_id, []);
        }
        if (!userContentMap.get(item.user_id)!.includes(item.content_id)) {
          userContentMap.get(item.user_id)!.push(item.content_id);
        }
      }
    }

    console.log(`Found ${userContentMap.size} users to notify`);

    // Send notifications to each user
    for (const [userId, userContentIds] of userContentMap) {
      try {
        // Check notification preferences
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('coming_soon_alerts')
          .eq('user_id', userId)
          .single();

        if (prefs && !prefs.coming_soon_alerts) {
          console.log(`User ${userId} has disabled coming soon alerts`);
          continue;
        }

        // Get user email from auth
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        if (!userData?.user?.email) {
          console.log(`No email for user ${userId}`);
          continue;
        }

        // Get the content details for this user
        const userContent = leavingContent.filter(c => userContentIds.includes(c.id));
        
        const contentList = userContent.map(c => {
          const daysLeft = Math.ceil((new Date(c.expires_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return `<li style="margin-bottom: 10px;">
            <strong>${c.title}</strong> - Leaving in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}
          </li>`;
        }).join('');

        const { error: emailError } = await resend.emails.send({
          from: 'Notifications <notifications@resend.dev>',
          to: [userData.user.email],
          subject: `⏰ ${userContent.length} title${userContent.length !== 1 ? 's' : ''} you've watched ${userContent.length !== 1 ? 'are' : 'is'} leaving soon!`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #333; margin-bottom: 20px;">Don't miss out! 🎬</h1>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                The following titles you've been watching are leaving our platform soon. Watch them before they're gone!
              </p>
              <ul style="list-style: none; padding: 0; margin: 20px 0;">
                ${contentList}
              </ul>
              <a href="${Deno.env.get('SITE_URL') || 'https://app.example.com'}" 
                 style="display: inline-block; background: #e50914; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Watch Now
              </a>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                You're receiving this because you have content leaving alerts enabled. 
                <a href="${Deno.env.get('SITE_URL') || 'https://app.example.com'}/settings" style="color: #999;">Manage preferences</a>
              </p>
            </div>
          `,
        });

        if (emailError) {
          console.error(`Failed to send email to ${userData.user.email}:`, emailError);
        } else {
          notificationsSent++;
          console.log(`Sent leaving soon notification to ${userData.user.email}`);

          // Create in-app notification
          await supabase.from('notifications').insert({
            user_id: userId,
            title: 'Content Leaving Soon',
            body: `${userContent.length} title${userContent.length !== 1 ? 's' : ''} you've watched ${userContent.length !== 1 ? 'are' : 'is'} leaving soon!`,
            type: 'leaving_soon',
          });
        }
      } catch (userError) {
        console.error(`Error processing user ${userId}:`, userError);
      }
    }

    console.log(`Sent ${notificationsSent} leaving soon notifications`);

    return new Response(
      JSON.stringify({ success: true, notificationsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in notify-leaving-soon:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
