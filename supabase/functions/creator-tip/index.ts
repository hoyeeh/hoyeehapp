import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation helpers
const isValidUUID = (str: unknown): str is string => {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

const isValidAction = (action: unknown): action is 'initialize' | 'verify' => {
  return action === 'initialize' || action === 'verify';
};

const isValidAmount = (amount: unknown): amount is number => {
  if (typeof amount !== 'number') return false;
  return amount > 0 && amount <= 10000000 && Number.isFinite(amount);
};

const sanitizeMessage = (msg: unknown): string | null => {
  if (msg === undefined || msg === null) return null;
  if (typeof msg !== 'string') return null;
  // Limit length and remove potential XSS characters
  return msg.slice(0, 500).replace(/[<>]/g, '');
};

const isValidTxRef = (txRef: unknown): txRef is string => {
  if (typeof txRef !== 'string') return false;
  return txRef.length > 0 && txRef.length <= 200;
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

    const { action, creatorId, amount, message, txRef } = body as Record<string, unknown>;

    // Validate action
    if (!isValidAction(action)) {
      return new Response(JSON.stringify({ error: "Invalid action. Must be: initialize or verify" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Creator tip request:", { action, creatorId, amount: typeof amount === 'number' ? amount : 'invalid', userId: user.id });

    if (action === "initialize") {
      // Validate creatorId
      if (!isValidUUID(creatorId)) {
        return new Response(JSON.stringify({ error: "Invalid creatorId format. Must be a valid UUID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate amount
      if (!isValidAmount(amount)) {
        return new Response(JSON.stringify({ error: "Invalid amount. Must be a positive number up to 10,000,000" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sanitize message
      const sanitizedMessage = sanitizeMessage(message);

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
      const generatedTxRef = `TIP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Initialize Flutterwave payment
      const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flutterwaveSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: generatedTxRef,
          amount: amount as number,
          currency: "XAF",
          redirect_url: `${req.headers.get("origin")}/creator/${creatorId}?tip=success`,
          customer: {
            email: userEmail,
            name: user.user_metadata?.display_name || "Supporter",
          },
          customizations: {
            title: `Tip for ${creator.display_name}`,
            description: sanitizedMessage || `Support ${creator.display_name}`,
          },
          meta: {
            tip_id: generatedTxRef,
            creator_id: creatorId,
            tipper_user_id: user.id,
            message: sanitizedMessage,
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
        creator_id: creatorId as string,
        tipper_user_id: user.id,
        amount: amount as number,
        currency: "XAF",
        message: sanitizedMessage,
        payment_provider: "flutterwave",
        payment_reference: generatedTxRef,
        status: "pending",
      });

      return new Response(
        JSON.stringify({
          success: true,
          paymentLink: flutterwaveData.data.link,
          txRef: generatedTxRef,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      // Validate txRef
      if (!isValidTxRef(txRef)) {
        return new Response(JSON.stringify({ error: "Invalid txRef format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify with Flutterwave
      const verifyResponse = await fetch(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef as string)}`,
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
          .eq("payment_reference", txRef as string);

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
