import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !supabaseServiceKey) {
      console.error("Missing required environment variables");
      throw new Error("Server configuration error");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the raw body and signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("No Stripe signature found");
      return new Response(JSON.stringify({ error: "No signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err?.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Received Stripe event:", event.type);

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout session completed:", session.id);
        
        // Get the subscription from our database using payment reference
        const { data: subscription, error: subError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("payment_reference", session.id)
          .single();

        if (subError || !subscription) {
          console.log("Subscription not found for session:", session.id);
          // Try to find by customer email
          if (session.customer_email) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("id", session.client_reference_id)
              .single();
            
            if (profile) {
              // Update subscription status
              const { error: updateError } = await supabase
                .from("subscriptions")
                .update({
                  status: "active",
                  starts_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", profile.id)
                .eq("status", "pending")
                .order("created_at", { ascending: false })
                .limit(1);

              if (updateError) {
                console.error("Error updating subscription:", updateError);
              }
            }
          }
        } else {
          // Update subscription to active
          const expiresAt = new Date();
          if (subscription.plan_type === "monthly") {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          } else if (subscription.plan_type === "yearly") {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          }

          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              status: "active",
              starts_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", subscription.id);

          if (updateError) {
            console.error("Error updating subscription:", updateError);
          } else {
            // Update user profile
            await supabase
              .from("profiles")
              .update({
                is_subscribed: true,
                subscription_expiry: expiresAt.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", subscription.user_id);

            console.log("Subscription activated for user:", subscription.user_id);
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Invoice payment succeeded:", invoice.id);
        
        // This handles subscription renewals
        if (invoice.subscription && invoice.customer_email) {
          // Find user by email in auth
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const user = authUsers?.users?.find(u => u.email === invoice.customer_email);
          
          if (user) {
            // Get current subscription
            const { data: currentSub } = await supabase
              .from("subscriptions")
              .select("*")
              .eq("user_id", user.id)
              .eq("status", "active")
              .order("created_at", { ascending: false })
              .limit(1)
              .single();

            if (currentSub) {
              // Extend subscription
              const newExpiry = new Date(currentSub.expires_at || new Date());
              if (currentSub.plan_type === "monthly") {
                newExpiry.setMonth(newExpiry.getMonth() + 1);
              } else {
                newExpiry.setFullYear(newExpiry.getFullYear() + 1);
              }

              await supabase
                .from("subscriptions")
                .update({
                  expires_at: newExpiry.toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", currentSub.id);

              await supabase
                .from("profiles")
                .update({
                  subscription_expiry: newExpiry.toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

              console.log("Subscription renewed for user:", user.id);
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Invoice payment failed:", invoice.id);
        
        if (invoice.customer_email) {
          const { data: authUsers } = await supabase.auth.admin.listUsers();
          const user = authUsers?.users?.find(u => u.email === invoice.customer_email);
          
          if (user) {
            // Mark subscription as past_due
            await supabase
              .from("subscriptions")
              .update({
                status: "past_due",
                admin_notes: `Payment failed on ${new Date().toISOString()}`,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", user.id)
              .eq("status", "active");

            console.log("Subscription marked as past_due for user:", user.id);

            // Send notification email
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-subscription-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email_type: "payment_failed",
                  to_email: invoice.customer_email,
                  user_name: user.user_metadata?.display_name || invoice.customer_email.split("@")[0],
                }),
              });
            } catch (emailError) {
              console.error("Failed to send payment failed email:", emailError);
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Subscription cancelled:", subscription.id);
        
        // Find user and update subscription status
        if (subscription.customer) {
          const customer = await stripe.customers.retrieve(subscription.customer as string);
          if (customer && !customer.deleted && customer.email) {
            const { data: authUsers } = await supabase.auth.admin.listUsers();
            const user = authUsers?.users?.find(u => u.email === customer.email);
            
            if (user) {
              await supabase
                .from("subscriptions")
                .update({
                  status: "cancelled",
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", user.id)
                .eq("status", "active");

              await supabase
                .from("profiles")
                .update({
                  is_subscribed: false,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

              console.log("Subscription cancelled for user:", user.id);

              // Send cancellation email
              try {
                await fetch(`${supabaseUrl}/functions/v1/send-subscription-email`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email_type: "subscription_cancelled",
                    to_email: customer.email,
                    user_name: user.user_metadata?.display_name || customer.email.split("@")[0],
                  }),
                });
              } catch (emailError) {
                console.error("Failed to send cancellation email:", emailError);
              }
            }
          }
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
