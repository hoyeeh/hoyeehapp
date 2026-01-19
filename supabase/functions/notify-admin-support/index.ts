import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminSupportNotificationRequest {
  ticketId: string;
  ticketSubject: string;
  ticketType: string;
  message: string;
  isNewTicket: boolean;
  userName?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is authenticated
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

    const { 
      ticketId, 
      ticketSubject, 
      ticketType, 
      message, 
      isNewTicket,
      userName 
    }: AdminSupportNotificationRequest = await req.json();

    console.log(`Support notification: ${isNewTicket ? 'New ticket' : 'New message'} for ticket ${ticketId}`);

    // Get all admin users
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'super_admin']);

    if (rolesError) {
      console.error('Error fetching admin roles:', rolesError);
      throw rolesError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log('No admins found to notify');
      return new Response(
        JSON.stringify({ success: true, notificationsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserIds = [...new Set(adminRoles.map(r => r.user_id))];
    console.log(`Found ${adminUserIds.length} admins to notify`);

    // Format the notification
    const ticketTypeLabels: Record<string, string> = {
      'general': 'General',
      'movie_request': 'Movie Request',
      'show_request': 'TV Show Request',
      'technical': 'Technical Issue',
      'billing': 'Billing',
      'other': 'Other'
    };

    const typeLabel = ticketTypeLabels[ticketType] || ticketType;
    const displayName = userName || 'A user';
    
    const title = isNewTicket 
      ? `🎫 New Support Ticket: ${ticketSubject}`
      : `💬 New Reply: ${ticketSubject}`;
    
    const body = isNewTicket
      ? `${displayName} created a ${typeLabel} ticket: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`
      : `${displayName} replied: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`;

    // Create in-app notifications for all admins
    const notifications = adminUserIds.map(adminId => ({
      user_id: adminId,
      title,
      body,
      type: 'support_ticket',
      content_id: ticketId,
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error inserting admin notifications:', insertError);
      throw insertError;
    }

    // Try to send push notifications to admins with subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', adminUserIds);

    let pushSuccesses = 0;
    if (subscriptions && subscriptions.length > 0) {
      for (const sub of subscriptions) {
        try {
          const payloadString = JSON.stringify({
            title,
            body,
            icon: '/pwa-icon-192.png',
            badge: '/pwa-icon-192.png',
            url: '/admin',
            tag: 'hoyeeh-support-notification'
          });

          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'TTL': '86400',
              'Content-Type': 'application/json',
              'Urgency': 'high',
            },
            body: payloadString
          });

          if (response.ok || response.status === 201) {
            pushSuccesses++;
          }
        } catch (pushError) {
          console.error('Push notification error:', pushError);
        }
      }
    }

    // Also try Pusher notification if configured
    const pusherAppId = Deno.env.get('PUSHER_APP_ID');
    const pusherKey = Deno.env.get('PUSHER_KEY');
    const pusherSecret = Deno.env.get('PUSHER_SECRET');
    const pusherCluster = Deno.env.get('PUSHER_CLUSTER');

    if (pusherAppId && pusherKey && pusherSecret && pusherCluster) {
      try {
        // Send to admin channel
        const channel = 'private-admin-notifications';
        const event = 'support-ticket';
        const data = JSON.stringify({ 
          title, 
          body, 
          ticketId, 
          isNewTicket,
          timestamp: new Date().toISOString()
        });

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const bodyMd5 = await crypto.subtle.digest('MD5', new TextEncoder().encode(data))
          .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
        
        const signatureString = `POST\n/apps/${pusherAppId}/events\nauth_key=${pusherKey}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(pusherSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureString));
        const authSignature = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

        const pusherUrl = `https://api-${pusherCluster}.pusher.com/apps/${pusherAppId}/events?auth_key=${pusherKey}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}&auth_signature=${authSignature}`;
        
        await fetch(pusherUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: event,
            channel,
            data
          })
        });
        
        console.log('Pusher notification sent to admin channel');
      } catch (pusherError) {
        console.error('Pusher notification error:', pusherError);
      }
    }

    console.log(`Created ${notifications.length} admin notifications, ${pushSuccesses} push notifications sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent: notifications.length,
        pushSuccesses
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in notify-admin-support function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
