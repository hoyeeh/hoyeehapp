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

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Web Push implementation using Fetch API
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string; contentId?: string }
): Promise<boolean> {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.log('VAPID keys not configured, skipping web push');
    return false;
  }

  try {
    // Create the JWT for VAPID authentication
    const audience = new URL(subscription.endpoint).origin;
    const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours

    // Create VAPID JWT header
    const header = {
      typ: 'JWT',
      alg: 'ES256'
    };

    const claims = {
      aud: audience,
      exp: expiration,
      sub: 'mailto:info@hoyeeh.com'
    };

    // For now, send the notification without encryption (limited browser support)
    // This approach stores notifications in DB and relies on in-app notifications
    console.log(`Sending push to ${subscription.endpoint}:`, JSON.stringify(payload));

    // The payload to send
    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      url: payload.url || '/',
      contentId: payload.contentId,
      tag: 'hoyeeh-notification'
    });

    // Make the push request
    // Note: Full Web Push encryption requires complex ECDH key exchange
    // For production, consider using a push service like Firebase Cloud Messaging
    // or implementing full encryption with crypto libraries
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'TTL': '86400',
        'Content-Type': 'application/json',
        'Urgency': 'normal',
      },
      body: payloadString
    });

    if (response.ok || response.status === 201) {
      console.log('Push notification sent successfully');
      return true;
    } else {
      console.log(`Push failed with status ${response.status}: ${await response.text()}`);
      // Don't fail silently - the notification is still stored in DB
      return false;
    }
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
    let pushAttempts = 0;
    let pushSuccesses = 0;

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
            pushAttempts++;
            const success = await sendWebPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              { title, body, url: url || (contentId ? `/content/${contentId}` : '/'), contentId }
            );
            if (success) pushSuccesses++;
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
            pushAttempts++;
            const success = await sendWebPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              { title, body, url: url || (contentId ? `/content/${contentId}` : '/'), contentId }
            );
            if (success) pushSuccesses++;
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

    console.log(`Created ${notifications.length} in-app notifications, sent ${pushSuccesses}/${pushAttempts} push notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent: notifications.length,
        pushAttempts,
        pushSuccesses
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
