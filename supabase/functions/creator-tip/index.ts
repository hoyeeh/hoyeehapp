import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, creatorId, amount, message } = await req.json();
    console.log("Creator tip request:", { action, creatorId, amount, userId: user.id });

    if (action === "initialize") {
      // Get creator profile
      const { data: creator, error: creatorError } = await supabaseClient
        .from("creator_profiles")
        .select("id, display_name, user_id")
        .eq("id", creatorId)
        .single();

      if (creatorError || !creator) {
        return new Response(JSON.stringify({ error: "Creator not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user email
      const { data: userAuth } = await supabaseClient.auth.admin.getUserById(user.id);
      const userEmail = userAuth?.user?.email || "";

      // Create transaction reference
      const txRef = `TIP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Initialize Flutterwave payment
      const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flutterwaveSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: txRef,
          amount: amount,
          currency: "XAF",
          redirect_url: `${req.headers.get("origin")}/creator/${creatorId}?tip=success`,
          customer: {
            email: userEmail,
            name: user.user_metadata?.display_name || "Supporter",
          },
          customizations: {
            title: `Tip for ${creator.display_name}`,
            description: message || `Support ${creator.display_name}`,
          },
          meta: {
            tip_id: txRef,
            creator_id: creatorId,
            tipper_user_id: user.id,
            message: message || null,
          },
        }),
      });

      const flutterwaveData = await flutterwaveResponse.json();
      console.log("Flutterwave response:", flutterwaveData);

      if (flutterwaveData.status !== "success") {
        throw new Error(flutterwaveData.message || "Payment initialization failed");
      }

      // Create pending tip record
      await supabaseClient.from("creator_tips").insert({
        creator_id: creatorId,
        tipper_user_id: user.id,
        amount: amount,
        currency: "XAF",
        message: message || null,
        payment_provider: "flutterwave",
        payment_reference: txRef,
        status: "pending",
      });

      return new Response(
        JSON.stringify({
          success: true,
          paymentLink: flutterwaveData.data.link,
          txRef,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      const { txRef } = await req.json();

      // Verify with Flutterwave
      const verifyResponse = await fetch(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${txRef}`,
        {
          headers: { Authorization: `Bearer ${flutterwaveSecretKey}` },
        }
      );

      const verifyData = await verifyResponse.json();
      console.log("Verification response:", verifyData);

      if (verifyData.status === "success" && verifyData.data.status === "successful") {
        // Update tip status to completed - trigger will update creator balance
        await supabaseClient
          .from("creator_tips")
          .update({ status: "completed" })
          .eq("payment_reference", txRef);

        return new Response(
          JSON.stringify({ success: true, message: "Tip sent successfully!" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Payment verification failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Creator tip error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
