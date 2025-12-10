import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY")!;
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

    const { action, ...params } = await req.json();

    // Fetch current pricing from subscription_settings
    const { data: settings } = await supabase
      .from("subscription_settings")
      .select("base_price")
      .eq("plan_type", "monthly")
      .single();

    const monthlyPrice = settings?.base_price || 2000;

    if (action === "initialize") {
      console.log("Initializing Flutterwave payment for user:", user.id);

      const txRef = `hoyeeh-${user.id}-${Date.now()}`;
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
          amount: monthlyPrice,
          currency: "XAF",
          payment_options: "mobilemoneyrwanda, mobilemoneyghana, mobilemoneyfranco, mobilemoneyuganda, mobilemoneyzambia",
          redirect_url: `${origin}/subscription?tx_ref=${txRef}`,
          customer: {
            email: user.email,
            name: user.user_metadata?.display_name || user.email?.split("@")[0],
          },
          customizations: {
            title: "Hoyeeh Premium",
            description: "Monthly Premium Subscription",
            logo: `${origin}/favicon.png`,
          },
          meta: {
            user_id: user.id,
            plan_type: "monthly",
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
        plan_type: "monthly",
        payment_provider: "flutterwave",
        payment_reference: txRef,
        amount: monthlyPrice,
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
      const { tx_ref } = params;
      
      console.log("Verifying Flutterwave payment:", tx_ref);

      // Verify transaction
      const response = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`, {
        headers: {
          "Authorization": `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      });

      const result = await response.json();

      if (result.status === "success" && result.data.status === "successful") {
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
            monthlyPrice,
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
