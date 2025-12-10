import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Monthly price in XAF
const MONTHLY_PRICE_XAF = 2500;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { action } = await req.json();

    if (action === "create-checkout") {
      console.log("Creating Stripe checkout session for user:", user.id);

      // Create Stripe checkout session
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "mode": "subscription",
          "success_url": `${req.headers.get("origin")}/subscription?success=true`,
          "cancel_url": `${req.headers.get("origin")}/subscription?canceled=true`,
          "line_items[0][price_data][currency]": "xaf",
          "line_items[0][price_data][unit_amount]": String(MONTHLY_PRICE_XAF),
          "line_items[0][price_data][recurring][interval]": "month",
          "line_items[0][price_data][product_data][name]": "Hoyeeh Premium Monthly",
          "line_items[0][price_data][product_data][description]": "Unlimited access to all premium content",
          "line_items[0][quantity]": "1",
          "metadata[user_id]": user.id,
          "customer_email": user.email || "",
        }),
      });

      const session = await response.json();

      if (session.error) {
        console.error("Stripe error:", session.error);
        throw new Error(session.error.message);
      }

      // Create pending subscription record
      const { error: insertError } = await supabase.from("subscriptions").insert({
        user_id: user.id,
        plan_type: "monthly",
        payment_provider: "stripe",
        payment_reference: session.id,
        amount: MONTHLY_PRICE_XAF,
        currency: "XAF",
        status: "pending",
      });

      if (insertError) {
        console.error("DB insert error:", insertError);
      }

      console.log("Checkout session created:", session.id);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify-payment") {
      const { sessionId } = await req.json();
      
      // Retrieve session from Stripe
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        },
      });

      const session = await response.json();

      if (session.payment_status === "paid") {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

        // Update subscription status
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            starts_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .eq("payment_reference", sessionId);

        // Update user profile
        await supabase
          .from("profiles")
          .update({
            is_subscribed: true,
            subscription_expiry: expiresAt.toISOString(),
          })
          .eq("id", user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});