import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at?: string;
    bounce?: {
      message: string;
      type?: string;
    };
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Resend webhook received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const event: ResendWebhookEvent = await req.json();
    console.log("Webhook event type:", event.type);
    console.log("Email ID:", event.data.email_id);

    const messageId = event.data.email_id;
    const now = new Date().toISOString();

    let updateData: Record<string, any> = {};

    switch (event.type) {
      case "email.delivered":
        updateData = { status: "delivered", delivered_at: now };
        break;
      case "email.opened":
        updateData = { status: "opened", opened_at: now };
        break;
      case "email.clicked":
        updateData = { clicked_at: now };
        break;
      case "email.bounced":
        updateData = {
          status: "bounced",
          bounced_at: now,
          bounce_type: event.data.bounce?.type || "unknown",
          bounce_reason: event.data.bounce?.message || "Unknown bounce reason",
        };
        break;
      case "email.complained":
        updateData = { status: "complained" };
        break;
      default:
        console.log("Unhandled event type:", event.type);
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from("email_logs")
        .update(updateData)
        .eq("message_id", messageId);

      if (error) {
        console.error("Error updating email log:", error);
      } else {
        console.log("Email log updated successfully for:", messageId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
