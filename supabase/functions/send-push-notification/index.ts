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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, title, body, type, contentId, sendToAll, url }: PushNotificationRequest = await req.json();

    console.log(`Sending push notification: ${title} - ${body}`);

    let userIds: string[] = [];

    if (sendToAll) {
      // Get all users with push subscriptions
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh, auth');
      
      if (subscriptions && subscriptions.length > 0) {
        // Send web push to each subscription
        for (const sub of subscriptions) {
          await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { title, body, url: url || (contentId ? `/content/${contentId}` : '/') }
          );
        }
        userIds = [...new Set(subscriptions.map(s => s.user_id))];
      }
    } else if (userId) {
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
    }

    // Create in-app notifications for each user
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

    console.log(`Created ${notifications.length} notifications`);

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
