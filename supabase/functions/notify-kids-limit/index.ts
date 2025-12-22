import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOGO_URL = "https://hoyeeh-videos.sfo3.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png";

interface NotifyRequest {
  profileId: string;
  type: 'time_limit' | 'bedtime';
  profileName: string;
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
      .select('user_id, name, daily_time_limit_minutes, bedtime_time')
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

    // Create notification title and body based on type
    let title: string;
    let body: string;
    
    if (type === 'time_limit') {
      title = `${childName}'s Watch Time is Up! ⏰`;
      body = `${childName} has reached their daily screen time limit of ${kidsProfile.daily_time_limit_minutes} minutes. Playback has been paused.`;
    } else {
      title = `Bedtime for ${childName}! 🌙`;
      body = `It's past ${kidsProfile.bedtime_time || 'bedtime'} - ${childName}'s bedtime. Playback has been paused to help them wind down.`;
    }

    // Create in-app notification for the parent
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
        parentUserId 
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
