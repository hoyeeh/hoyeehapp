import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  userId?: string;
  title: string;
  body: string;
  type: string;
  contentId?: string;
  sendToAll?: boolean;
  url?: string;
}

// Web Push implementation
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string }
) {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.log('VAPID keys not configured, skipping web push');
    return false;
  }

  try {
    // For actual web push, you'd use a library like web-push
    // This is a simplified version that stores notifications in DB
    console.log(`Would send push to ${subscription.endpoint}:`, payload);
    return true;
  } catch (error) {
    console.error('Error sending web push:', error);
    return false;
  }
}

// Get preference field based on notification type
function getPreferenceField(type: string): string {
  switch (type) {
    case 'new_release':
    case 'release':
      return 'new_releases';
    case 'coming_soon':
      return 'coming_soon_alerts';
    case 'subscription':
    case 'renewal':
    case 'expiration':
      return 'subscription_reminders';
    case 'promotional':
    case 'promo':
      return 'promotional';
    case 'weekly_digest':
      return 'weekly_digest';
    default:
      return 'new_releases';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid token:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is an admin
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      console.error('User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, title, body, type, contentId, sendToAll, url }: PushNotificationRequest = await req.json();

    console.log(`Admin ${user.id} sending ${type} push notification: ${title}`);

    let userIds: string[] = [];
    const preferenceField = getPreferenceField(type);

    if (sendToAll) {
      // Get all users with push subscriptions
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh, auth');
      
      if (subscriptions && subscriptions.length > 0) {
        const allUserIds = [...new Set(subscriptions.map(s => s.user_id))];
        
        // Fetch notification preferences for these users
        const { data: preferences } = await supabase
          .from('notification_preferences')
          .select(`user_id, ${preferenceField}`)
          .in('user_id', allUserIds);

        // Create a map of user preferences
        const prefsMap = new Map<string, boolean>();
        preferences?.forEach((p: any) => {
          prefsMap.set(p.user_id, p[preferenceField]);
        });

        // Filter to users who have opted in (or have no preference - default to true)
        const optedInUserIds = allUserIds.filter(uid => {
          const pref = prefsMap.get(uid);
          return pref === true || pref === undefined;
        });

        console.log(`${optedInUserIds.length} of ${allUserIds.length} users opted in for ${preferenceField}`);

        // Send web push to opted-in users' subscriptions
        for (const sub of subscriptions) {
          if (optedInUserIds.includes(sub.user_id)) {
            await sendWebPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              { title, body, url: url || (contentId ? `/content/${contentId}` : '/') }
            );
          }
        }
        userIds = optedInUserIds;
      }
    } else if (userId) {
      // Check if this specific user has opted in
      const { data: userPref } = await supabase
        .from('notification_preferences')
        .select(preferenceField)
        .eq('user_id', userId)
        .single();

      // Only proceed if user has opted in or has no preference
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prefValue = userPref ? (userPref as any)[preferenceField] : undefined;
      const hasOptedIn = prefValue !== false;

      if (hasOptedIn) {
        // Get specific user's subscriptions
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', userId);

        if (subscriptions) {
          for (const sub of subscriptions) {
            await sendWebPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              { title, body, url: url || (contentId ? `/content/${contentId}` : '/') }
            );
          }
        }
        userIds = [userId];
      } else {
        console.log(`User ${userId} has opted out of ${preferenceField} notifications`);
      }
    }

    // Create in-app notifications for opted-in users
    const notifications = userIds.map(uid => ({
      user_id: uid,
      title,
      body,
      type,
      content_id: contentId || null,
    }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error inserting notifications:', insertError);
      }
    }

    console.log(`Created ${notifications.length} notifications (respecting user preferences)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent: notifications.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-push-notification function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
