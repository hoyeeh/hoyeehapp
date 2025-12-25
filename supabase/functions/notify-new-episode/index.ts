import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { episodeId, contentId, episodeTitle, seasonNumber, episodeNumber } = await req.json();

    if (!contentId) {
      return new Response(
        JSON.stringify({ error: "content_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get content info
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('title, thumbnail_url')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      return new Response(
        JSON.stringify({ error: "Content not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all users subscribed to this series
    const { data: subscribers, error: subError } = await supabase
      .from('series_subscriptions')
      .select('user_id')
      .eq('content_id', contentId);

    if (subError) {
      throw subError;
    }

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscribers to notify", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create notifications for each subscriber
    const notifications = subscribers.map(sub => ({
      user_id: sub.user_id,
      title: `New Episode of ${content.title}`,
      body: episodeTitle 
        ? `S${seasonNumber}E${episodeNumber}: ${episodeTitle} is now available!`
        : `A new episode is now available!`,
      type: 'new_episode',
      content_id: contentId,
      read: false
    }));

    const { error: notifyError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifyError) {
      throw notifyError;
    }

    // Send push notifications if available
    const { data: pushSubs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', subscribers.map(s => s.user_id));

    if (pushSubs && pushSubs.length > 0) {
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

      if (vapidPublicKey && vapidPrivateKey) {
        // Send push notifications (using web-push pattern)
        for (const sub of pushSubs) {
          try {
            // Push notification logic would go here
            // For now, just log that we would send it
            console.log(`Would send push to user ${sub.user_id}`);
          } catch (pushError) {
            console.error(`Failed to send push to ${sub.user_id}:`, pushError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: subscribers.length,
        message: `Notified ${subscribers.length} subscribers` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error notifying subscribers:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
