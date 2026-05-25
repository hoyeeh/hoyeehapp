import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to send confirmation email
async function sendConfirmationEmail(supabaseUrl: string, userEmail: string, userName: string, amount: number, planType: string, expiryDate: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-subscription-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: userEmail,
        type: "payment_confirmation",
        data: {
          userName,
          amount,
          currency: "XAF",
          planType: planType === "yearly" ? "Yearly" : "Monthly",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!stripeSecretKey) {
      console.error("Missing STRIPE_SECRET_KEY");
      throw new Error("Stripe is not configured");
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error("Missing authorization header");
    }

    // Create client with user's auth context to verify user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError) {
      console.error("Auth error:", authError.message);
      throw new Error("Unauthorized");
    }
    
    if (!user) {
      console.error("No user found in token");
      throw new Error("Unauthorized");
    }

    console.log("User verified:", user.id, user.email);

    // Create admin client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, sessionId, plan_type = "monthly" } = await req.json();

    // Fetch current pricing from subscription_settings
    const { data: settings } = await supabase
      .from("subscription_settings")
      .select("base_price, plan_type")
      .eq("is_active", true);

    const monthlySettings = settings?.find(s => s.plan_type === "monthly");
    const yearlySettings = settings?.find(s => s.plan_type === "yearly");
    
    const monthlyPrice = monthlySettings?.base_price || 2500;
    const yearlyPrice = yearlySettings?.base_price || 20000;
    
    const selectedPrice = plan_type === "yearly" ? yearlyPrice : monthlyPrice;
    const interval = plan_type === "yearly" ? "year" : "month";
    const daysToAdd = plan_type === "yearly" ? 365 : 30;

    if (action === "create-checkout") {
      console.log(`Creating Stripe checkout session for user: ${user.id}, plan: ${plan_type}`);

      // Check if customer already exists in Stripe
      const existingCustomers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      let customerId: string | undefined;
      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
        console.log("Found existing Stripe customer:", customerId);
      }

      // Create Stripe checkout session using SDK
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        success_url: `${req.headers.get("origin")}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get("origin")}/subscription?canceled=true`,
        customer: customerId,
        customer_email: customerId ? undefined : user.email || undefined,
        line_items: [
          {
            price_data: {
              currency: "xaf",
              unit_amount: selectedPrice,
              recurring: {
                interval: interval as "month" | "year",
              },
              product_data: {
                name: `Hoyeeh Premium ${plan_type === "yearly" ? "Yearly" : "Monthly"}`,
                description: "Unlimited access to all premium content",
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          user_id: user.id,
          plan_type: plan_type,
        },
        subscription_data: {
          metadata: {
            user_id: user.id,
            plan_type: plan_type,
          },
        },
      });

      // Create pending subscription record
      const { error: insertError } = await supabase.from("subscriptions").insert({
        user_id: user.id,
        plan_type: plan_type,
        payment_provider: "stripe",
        payment_reference: session.id,
        amount: selectedPrice,
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
      console.log("Verifying payment for session:", sessionId);
      
      // Retrieve session from Stripe using SDK
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // CRITICAL: Verify the session belongs to the authenticated user
      if (session.metadata?.user_id && session.metadata.user_id !== user.id) {
        console.error("Session ownership mismatch", { sessionUser: session.metadata.user_id, authUser: user.id });
        return new Response(JSON.stringify({ error: "Unauthorized: session does not belong to this user" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (session.payment_status === "paid") {
        const verifiedPlanType = session.metadata?.plan_type || "monthly";
        const verifiedDaysToAdd = verifiedPlanType === "yearly" ? 365 : 30;
        const verifiedPrice = verifiedPlanType === "yearly" ? yearlyPrice : monthlyPrice;
        
        const now = new Date();
        const expiresAt = new Date(now.getTime() + verifiedDaysToAdd * 24 * 60 * 60 * 1000);

        // Update subscription status
        const { error: updateSubError } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            starts_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .eq("payment_reference", sessionId);

        if (updateSubError) {
          console.error("Error updating subscription:", updateSubError);
        }

        // Update user profile
        const { error: updateProfileError } = await supabase
          .from("profiles")
          .update({
            is_subscribed: true,
            subscription_expiry: expiresAt.toISOString(),
          })
          .eq("id", user.id);

        if (updateProfileError) {
          console.error("Error updating profile:", updateProfileError);
        }

        // Get user profile for email
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .single();

        // Send confirmation email
        if (user.email) {
          await sendConfirmationEmail(
            supabaseUrl,
            user.email,
            profile?.display_name || user.email.split("@")[0],
            verifiedPrice,
            verifiedPlanType,
            expiresAt.toLocaleDateString()
          );
        }

        console.log("Payment verified successfully for user:", user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Payment not completed, status:", session.payment_status);
      return new Response(JSON.stringify({ success: false, status: session.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-portal") {
      console.log("Creating customer portal session for user:", user.id);
      
      // Find customer by email
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (customers.data.length === 0) {
        throw new Error("No Stripe customer found for this user");
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customers.data[0].id,
        return_url: `${req.headers.get("origin")}/subscription`,
      });

      return new Response(JSON.stringify({ url: portalSession.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe payment error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
