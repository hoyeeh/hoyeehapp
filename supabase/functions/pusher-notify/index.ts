import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PusherEvent {
  channel: string;
  event: string;
  data: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: hasRole } = await supabaseClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (!hasRole) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { channel, event, data, targetUserId } = await req.json();

    const appId = Deno.env.get("PUSHER_APP_ID");
    const key = Deno.env.get("PUSHER_KEY");
    const secret = Deno.env.get("PUSHER_SECRET");
    const cluster = Deno.env.get("PUSHER_CLUSTER") || "us2";

    if (!appId || !key || !secret) {
      console.error("Pusher credentials not configured");
      return new Response(
        JSON.stringify({ error: "Pusher not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare the event payload
    const pusherEvent: PusherEvent = {
      channel: targetUserId ? `private-user-${targetUserId}` : channel || "public-notifications",
      event: event || "notification",
      data: data || {},
    };

    // Generate Pusher authentication
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      name: pusherEvent.event,
      channel: pusherEvent.channel,
      data: JSON.stringify(pusherEvent.data),
    });

    const bodyMd5 = await crypto.subtle.digest(
      "MD5",
      new TextEncoder().encode(body)
    ).then((buf) => 
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );

    const stringToSign = [
      "POST",
      `/apps/${appId}/events`,
      `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`,
    ].join("\n");

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const signData = encoder.encode(stringToSign);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, signData);
    const authSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Send to Pusher
    const pusherUrl = `https://api-${cluster}.pusher.com/apps/${appId}/events?auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}&auth_signature=${authSignature}`;

    const pusherResponse = await fetch(pusherUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    if (!pusherResponse.ok) {
      const errorText = await pusherResponse.text();
      console.error("Pusher error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send Pusher notification", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also store in notifications table for persistence
    if (targetUserId && data.title && data.body) {
      await supabaseClient.from("notifications").insert({
        user_id: targetUserId,
        title: data.title,
        body: data.body,
        type: data.type || "general",
        content_id: data.contentId || null,
      });
    }

    console.log("Pusher notification sent:", pusherEvent);

    return new Response(
      JSON.stringify({ success: true, channel: pusherEvent.channel, event: pusherEvent.event }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Pusher notify error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
