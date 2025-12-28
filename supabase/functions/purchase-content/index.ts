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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from auth header
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    if (action === 'initialize') {
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

      // Check if already purchased
      const { data: existingPurchase } = await supabase
        .from('content_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('content_id', contentId)
        .eq('status', 'completed')
        .maybeSingle();

      if (existingPurchase) {
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
        .eq('id', user.id)
        .single();

      // Generate transaction reference
      const transactionRef = `purchase_${contentId}_${user.id}_${Date.now()}`;

      // Determine payment options based on selected method
      const paymentOptions = paymentMethod === 'card' 
        ? 'card' 
        : 'mobilemoney,mobilemoneyghana,mobilemoneyuganda,mobilemoneyzambia,mobilemoneyfranco';

      // Initialize Flutterwave payment
      const flutterwavePayload = {
        tx_ref: transactionRef,
        amount: paidContent.price,
        currency: paidContent.currency,
        redirect_url: `${supabaseUrl}/functions/v1/purchase-content-callback`,
        payment_options: paymentOptions,
        customer: {
          email: user.email,
          name: userProfile?.display_name || user.email
        },
        meta: {
          user_id: user.id,
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

      // Create pending purchase record
      await supabase
        .from('content_purchases')
        .insert({
          user_id: user.id,
          content_id: contentId,
          paid_content_id: paidContent.id,
          creator_id: paidContent.creator_id,
          amount: paidContent.price,
          currency: paidContent.currency,
          creator_share: creatorShare,
          platform_share: platformShare,
          payment_provider: 'flutterwave',
          payment_reference: transactionRef,
          status: 'pending'
        });

      return new Response(
        JSON.stringify({
          success: true,
          paymentLink: flutterwaveResult.data.link,
          txRef: transactionRef
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify') {
      // Verify payment and complete purchase
      const verifyResponse = await fetch(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${txRef}`,
        {
          headers: {
            'Authorization': `Bearer ${flutterwaveSecretKey}`
          }
        }
      );

      const verifyResult = await verifyResponse.json();

      if (verifyResult.status !== 'success' || verifyResult.data?.status !== 'successful') {
        // Update purchase to failed
        await supabase
          .from('content_purchases')
          .update({ status: 'failed' })
          .eq('payment_reference', txRef);

        throw new Error('Payment verification failed');
      }

      // Get the pending purchase
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
      // Check if user has purchased content
      const { data: purchase } = await supabase
        .from('content_purchases')
        .select('id, status')
        .eq('user_id', user.id)
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
