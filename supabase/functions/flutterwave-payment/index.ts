import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Input validation helpers
const isValidAction = (action: unknown): action is 'initialize' | 'verify' => {
  return action === 'initialize' || action === 'verify';
};

const isValidPlanType = (planType: unknown): planType is 'monthly' | 'yearly' => {
  return planType === 'monthly' || planType === 'yearly';
};

const isValidTxRef = (txRef: unknown): txRef is string => {
  if (typeof txRef !== 'string') return false;
  return txRef.length > 0 && txRef.length <= 200;
};

// Helper to send confirmation email
async function sendConfirmationEmail(userEmail: string, userName: string, amount: number, planType: string, expiryDate: string) {
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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, plan_type, tx_ref } = body as Record<string, unknown>;

    // Validate action
    if (!isValidAction(action)) {
      return new Response(JSON.stringify({ error: "Invalid action. Must be: initialize or verify" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate plan_type for initialize
    const validatedPlanType = isValidPlanType(plan_type) ? plan_type : 'monthly';

    // Fetch current pricing from subscription_settings
    const { data: settings } = await supabase
      .from("subscription_settings")
      .select("base_price, plan_type")
      .eq("is_active", true);

    const monthlySettings = settings?.find(s => s.plan_type === "monthly");
    const yearlySettings = settings?.find(s => s.plan_type === "yearly");
    
    const monthlyPrice = monthlySettings?.base_price || 2500;
    const yearlyPrice = yearlySettings?.base_price || 20000;
    
    const selectedPrice = validatedPlanType === "yearly" ? yearlyPrice : monthlyPrice;
    const daysToAdd = validatedPlanType === "yearly" ? 365 : 30;

    if (action === "initialize") {
      console.log(`Initializing Flutterwave payment for user: ${user.id}, plan: ${plan_type}`);

      const txRef = `hoyeeh-${plan_type}-${user.id}-${Date.now()}`;
      const origin = req.headers.get("origin") || "https://hoyeeh.com";

      // Initialize Flutterwave payment
      const response = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: txRef,
          amount: selectedPrice,
          currency: "XAF",
          payment_options: "mobilemoneyrwanda, mobilemoneyghana, mobilemoneyfranco, mobilemoneyuganda, mobilemoneyzambia",
          redirect_url: `${origin}/subscription?tx_ref=${txRef}`,
          customer: {
            email: user.email,
            name: user.user_metadata?.display_name || user.email?.split("@")[0],
          },
          customizations: {
            title: "Hoyeeh Premium",
            description: `${plan_type === "yearly" ? "Yearly" : "Monthly"} Premium Subscription`,
            logo: `${origin}/favicon.png`,
          },
          meta: {
            user_id: user.id,
            plan_type: plan_type,
          },
        }),
      });

      const result = await response.json();

      if (result.status !== "success") {
        console.error("Flutterwave error:", result);
        throw new Error(result.message || "Failed to initialize payment");
      }

      // Create pending subscription record
      const { error: insertError } = await supabase.from("subscriptions").insert({
        user_id: user.id,
        plan_type: validatedPlanType,
        payment_provider: "flutterwave",
        payment_reference: txRef,
        amount: selectedPrice,
        currency: "XAF",
        status: "pending",
      });

      if (insertError) {
        console.error("DB insert error:", insertError);
      }

      console.log("Payment initialized:", txRef);

      return new Response(JSON.stringify({ 
        link: result.data.link,
        tx_ref: txRef,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      // Validate tx_ref
      if (!isValidTxRef(tx_ref)) {
        return new Response(JSON.stringify({ error: "Invalid tx_ref format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log("Verifying Flutterwave payment:", tx_ref);

      // Verify transaction
      const response = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref)}`, {
        headers: {
          "Authorization": `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      });

      const result = await response.json();

      if (result.status === "success" && result.data.status === "successful") {
        // CRITICAL: Verify the transaction belongs to the authenticated user
        const txUserId = result.data.meta?.user_id;
        if (txUserId && txUserId !== user.id) {
          console.error("Transaction ownership mismatch", { txUserId, authUser: user.id });
          return new Response(JSON.stringify({ error: "Unauthorized: transaction does not belong to this user" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Extract plan type from tx_ref (hoyeeh-{plan_type}-{user_id}-{timestamp})
        const verifiedPlanType = (tx_ref as string).split("-")[1] === "yearly" ? "yearly" : "monthly";
        const verifiedDaysToAdd = verifiedPlanType === "yearly" ? 365 : 30;
        const verifiedPrice = verifiedPlanType === "yearly" ? yearlyPrice : monthlyPrice;

        // CRITICAL: Verify amount and currency match expected plan price (prevent tampering)
        const paidAmount = Number(result.data.amount);
        const paidCurrency = String(result.data.currency || "").toUpperCase();
        if (paidCurrency !== "XAF" || paidAmount < verifiedPrice) {
          console.error("Amount/currency mismatch", { paidAmount, paidCurrency, expected: verifiedPrice });
          return new Response(JSON.stringify({ error: "Payment amount or currency does not match plan" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + verifiedDaysToAdd * 24 * 60 * 60 * 1000);


        // Update subscription status
        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            starts_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .eq("payment_reference", tx_ref);

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
            verifiedPrice,
            verifiedPlanType,
            expiresAt.toLocaleDateString()
          );
        }

        console.log("Payment verified successfully for user:", user.id);

        return new Response(JSON.stringify({ 
          success: true,
          message: "Subscription activated successfully",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        success: false,
        message: "Payment verification failed",
      }), {
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
