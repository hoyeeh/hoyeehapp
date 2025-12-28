import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation helpers
const isValidUUID = (str: unknown): str is string => {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

const isValidAction = (action: unknown): action is 'initialize' | 'verify' | 'check' => {
  return action === 'initialize' || action === 'verify' || action === 'check';
};

const isValidTxRef = (txRef: unknown): txRef is string => {
  if (txRef === undefined || txRef === null) return true; // Optional
  if (typeof txRef !== 'string') return false;
  return txRef.length > 0 && txRef.length <= 200;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization');
    
    // Get user from auth header (optional for verify action)
    let user: { id: string; email?: string } | null = null;
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user: authUser } } = await userClient.auth.getUser();
      user = authUser;
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, contentId, txRef, paymentMethod } = body as Record<string, unknown>;

    // Validate action
    if (!isValidAction(action)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action. Must be: initialize, verify, or check' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate contentId for actions that require it
    if ((action === 'initialize' || action === 'check') && !isValidUUID(contentId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid contentId format. Must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate txRef for verify action
    if (action === 'verify' && !isValidTxRef(txRef)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid txRef format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Actions that require authentication
    if ((action === 'initialize' || action === 'check') && !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'initialize') {
      // User is guaranteed non-null here due to the check above
      const authenticatedUser = user!;
      
      // Get paid content details
      const { data: paidContent, error: contentError } = await supabase
        .from('paid_content')
        .select('*, content(*), creator_profiles(*)')
        .eq('content_id', contentId)
        .eq('is_active', true)
        .single();

      if (contentError || !paidContent) {
        throw new Error('Paid content not found');
      }

      // Check if already purchased (or if there is an existing attempt)
      const { data: existingPurchase, error: existingPurchaseError } = await supabase
        .from('content_purchases')
        .select('id, status')
        .eq('user_id', authenticatedUser.id)
        .eq('content_id', contentId)
        .maybeSingle();

      if (existingPurchaseError) {
        throw existingPurchaseError;
      }

      if (existingPurchase?.status === 'completed') {
        throw new Error('Content already purchased');
      }

      // Get commission settings
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['creator_commission_percent', 'platform_commission_percent']);

      const settingsMap = (settings || []).reduce((acc, s) => {
        acc[s.setting_key] = parseFloat(s.setting_value);
        return acc;
      }, {} as Record<string, number>);

      const creatorPercent = settingsMap['creator_commission_percent'] || 70;
      const platformPercent = settingsMap['platform_commission_percent'] || 30;

      const creatorShare = (paidContent.price * creatorPercent) / 100;
      const platformShare = (paidContent.price * platformPercent) / 100;

      // Get user email
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', authenticatedUser.id)
        .single();

      // Generate transaction reference
      const transactionRef = `purchase_${contentId}_${authenticatedUser.id}_${Date.now()}`;

      // Route payment based on selected method
      if (paymentMethod === 'card' && stripeSecretKey) {
        // Use Stripe for card payments
        const Stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
        const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

        // Convert XAF to USD for Stripe (Stripe doesn't support XAF)
        // Using approximate exchange rate: 1 USD ≈ 600 XAF
        const XAF_TO_USD_RATE = 600;
        const amountInUSD = paidContent.price / XAF_TO_USD_RATE;
        
        // Stripe minimum is $0.50 USD
        if (amountInUSD < 0.50) {
          throw new Error('MINIMUM_AMOUNT_ERROR:The amount is too low for card payment. Please use Mobile Money or purchase content worth at least 300 XAF.');
        }
        
        // Convert to cents for Stripe
        const amountInCents = Math.round(amountInUSD * 100);

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
          customer_email: authenticatedUser.email || undefined,
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: paidContent.content?.title || 'Content Purchase',
                  description: `Purchase content from Hoyeeh (${paidContent.price} ${paidContent.currency})`,
                },
                unit_amount: amountInCents,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${req.headers.get('origin')}/creator-store?payment=success&tx_ref=${transactionRef}`,
          cancel_url: `${req.headers.get('origin')}/creator-store?payment=cancelled`,
          metadata: {
            tx_ref: transactionRef,
            user_id: authenticatedUser.id,
            content_id: contentId as string,
            paid_content_id: paidContent.id,
            creator_id: paidContent.creator_id,
            creator_share: creatorShare.toString(),
            platform_share: platformShare.toString(),
            original_amount: paidContent.price.toString(),
            original_currency: paidContent.currency,
          },
        });

        // Create (or reuse) pending purchase record (handles retries because user_id+content_id is unique)
        const { error: purchaseUpsertError } = await supabase
          .from('content_purchases')
          .upsert(
            {
              user_id: authenticatedUser.id,
              content_id: contentId,
              paid_content_id: paidContent.id,
              creator_id: paidContent.creator_id,
              amount: paidContent.price,
              currency: paidContent.currency,
              creator_share: creatorShare,
              platform_share: platformShare,
              payment_provider: 'stripe',
              payment_reference: transactionRef,
              status: 'pending',
            },
            { onConflict: 'user_id,content_id' }
          );

        if (purchaseUpsertError) throw purchaseUpsertError;

        return new Response(
          JSON.stringify({
            success: true,
            paymentLink: session.url,
            txRef: transactionRef
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Use Flutterwave for mobile money payments
        const paymentOptions = 'mobilemoney,mobilemoneyghana,mobilemoneyuganda,mobilemoneyzambia,mobilemoneyfranco';
        const origin = req.headers.get('origin') || 'https://hoyeeh.lovable.app';

        const flutterwavePayload = {
          tx_ref: transactionRef,
          amount: paidContent.price,
          currency: paidContent.currency,
          redirect_url: `${origin}/purchase-return?content_id=${contentId}`,
          payment_options: paymentOptions,
          customer: {
            email: authenticatedUser.email,
            name: userProfile?.display_name || authenticatedUser.email
          },
          meta: {
            user_id: authenticatedUser.id,
            content_id: contentId,
            paid_content_id: paidContent.id,
            creator_id: paidContent.creator_id,
            creator_share: creatorShare,
            platform_share: platformShare
          },
          customizations: {
            title: 'Hoyeeh Content Purchase',
            description: `Purchase: ${paidContent.content?.title}`,
            logo: 'https://example.com/logo.png'
          }
        };

        const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${flutterwaveSecretKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(flutterwavePayload)
        });

        const flutterwaveResult = await flutterwaveResponse.json();

        if (flutterwaveResult.status !== 'success') {
          throw new Error(flutterwaveResult.message || 'Payment initialization failed');
        }

        // Create (or reuse) pending purchase record (handles retries because user_id+content_id is unique)
        const { error: purchaseUpsertError } = await supabase
          .from('content_purchases')
          .upsert(
            {
              user_id: authenticatedUser.id,
              content_id: contentId,
              paid_content_id: paidContent.id,
              creator_id: paidContent.creator_id,
              amount: paidContent.price,
              currency: paidContent.currency,
              creator_share: creatorShare,
              platform_share: platformShare,
              payment_provider: 'flutterwave',
              payment_reference: transactionRef,
              status: 'pending',
            },
            { onConflict: 'user_id,content_id' }
          );

        if (purchaseUpsertError) throw purchaseUpsertError;

        return new Response(
          JSON.stringify({
            success: true,
            paymentLink: flutterwaveResult.data.link,
            txRef: transactionRef
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'verify') {
      // Get the pending purchase first to check payment provider
      const { data: purchase, error: purchaseError } = await supabase
        .from('content_purchases')
        .select('*')
        .eq('payment_reference', txRef)
        .single();

      if (purchaseError || !purchase) {
        throw new Error('Purchase record not found');
      }

      if (purchase.status === 'completed') {
        return new Response(
          JSON.stringify({ success: true, message: 'Already completed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let paymentVerified = false;

      if (purchase.payment_provider === 'stripe') {
        // Verify Stripe payment using checkout session
        const Stripe = (await import("https://esm.sh/stripe@14.21.0")).default;
        const stripe = new Stripe(stripeSecretKey!, { apiVersion: "2023-10-16" });
        
        // List checkout sessions and find the one with matching tx_ref
        const sessions = await stripe.checkout.sessions.list({
          limit: 10,
        });
        
        const matchingSession = sessions.data.find(
          (session: { metadata?: Record<string, string> }) => session.metadata?.tx_ref === txRef
        );
        
        if (matchingSession && matchingSession.payment_status === 'paid') {
          paymentVerified = true;
        }
      } else {
        // Verify Flutterwave payment
        const verifyResponse = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${txRef}`,
          {
            headers: {
              'Authorization': `Bearer ${flutterwaveSecretKey}`
            }
          }
        );

        const verifyResult = await verifyResponse.json();
        paymentVerified = verifyResult.status === 'success' && verifyResult.data?.status === 'successful';
      }

      if (!paymentVerified) {
        // Update purchase to failed
        await supabase
          .from('content_purchases')
          .update({ status: 'failed' })
          .eq('payment_reference', txRef);

        throw new Error('Payment verification failed');
      }


      // Update purchase to completed
      await supabase
        .from('content_purchases')
        .update({ status: 'completed' })
        .eq('id', purchase.id);

      // Update paid_content stats
      const { data: paidContent } = await supabase
        .from('paid_content')
        .select('sale_count, total_revenue')
        .eq('id', purchase.paid_content_id)
        .single();

      await supabase
        .from('paid_content')
        .update({
          sale_count: (paidContent?.sale_count || 0) + 1,
          total_revenue: (paidContent?.total_revenue || 0) + purchase.amount
        })
        .eq('id', purchase.paid_content_id);

      // Update creator earnings
      const { data: creatorProfile } = await supabase
        .from('creator_profiles')
        .select('total_earnings, pending_balance')
        .eq('id', purchase.creator_id)
        .single();

      await supabase
        .from('creator_profiles')
        .update({
          total_earnings: (creatorProfile?.total_earnings || 0) + purchase.creator_share,
          pending_balance: (creatorProfile?.pending_balance || 0) + purchase.creator_share
        })
        .eq('id', purchase.creator_id);

      return new Response(
        JSON.stringify({ success: true, message: 'Purchase completed successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'check') {
      // User is guaranteed non-null here due to the check above
      const authenticatedUser = user!;
      
      // Check if user has purchased content
      const { data: purchase } = await supabase
        .from('content_purchases')
        .select('id, status')
        .eq('user_id', authenticatedUser.id)
        .eq('content_id', contentId)
        .eq('status', 'completed')
        .maybeSingle();

      return new Response(
        JSON.stringify({ success: true, hasPurchased: !!purchase }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('Purchase content error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
