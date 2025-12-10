import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Helper to send confirmation email
async function sendConfirmationEmail(userEmail: string, userName: string, amount: number, expiryDate: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-subscription-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: userEmail,
        type: "payment_confirmation",
        data: {
          userName,
          amount,
          currency: "XAF",
          planType: "Monthly",
          expiryDate,
        },
      }),
    });
    console.log("Confirmation email sent to:", userEmail);
  } catch (e) {
    console.error("Failed to send confirmation email:", e);
  }
}

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

    const { action, sessionId } = await req.json();

    // Fetch current pricing from subscription_settings
    const { data: settings } = await supabase
      .from("subscription_settings")
      .select("base_price")
      .eq("plan_type", "monthly")
      .single();

    const monthlyPrice = settings?.base_price || 2000;

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
          "line_items[0][price_data][unit_amount]": String(monthlyPrice),
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
        amount: monthlyPrice,
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

        // Get user profile for email
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .single();

        // Send confirmation email
        if (user.email) {
          await sendConfirmationEmail(
            user.email,
            profile?.display_name || user.email.split("@")[0],
            monthlyPrice,
            expiresAt.toLocaleDateString()
          );
        }

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
