import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from auth header
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, payoutId, amount, payoutMethod, payoutDetails } = await req.json();

    // Get creator profile
    const { data: creatorProfile, error: profileError } = await supabase
      .from('creator_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError || !creatorProfile) {
      throw new Error('Creator profile not found');
    }

    if (action === 'request') {
      // Get minimum payout amount
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'minimum_payout_amount')
        .single();

      const minPayout = parseFloat(settings?.setting_value || '5000');

      if (amount < minPayout) {
        throw new Error(`Minimum payout amount is ${minPayout} XAF`);
      }

      if (amount > creatorProfile.pending_balance) {
        throw new Error('Insufficient balance');
      }

      // Create payout request
      const { data: payout, error: payoutError } = await supabase
        .from('creator_payouts')
        .insert({
          creator_id: creatorProfile.id,
          amount,
          payout_method: payoutMethod,
          payout_details: payoutDetails,
          status: 'pending'
        })
        .select()
        .single();

      if (payoutError) throw payoutError;

      // Update pending balance (reserve the amount)
      await supabase
        .from('creator_profiles')
        .update({
          pending_balance: creatorProfile.pending_balance - amount
        })
        .eq('id', creatorProfile.id);

      return new Response(
        JSON.stringify({ success: true, payout }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'process') {
      // Admin only - process payout via Flutterwave
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (!isAdmin) {
        throw new Error('Admin access required');
      }

      const { data: payout, error: payoutFetchError } = await supabase
        .from('creator_payouts')
        .select('*, creator_profiles(*)')
        .eq('id', payoutId)
        .single();

      if (payoutFetchError || !payout) {
        throw new Error('Payout not found');
      }

      if (payout.status !== 'pending') {
        throw new Error('Payout already processed');
      }

      // Update status to processing
      await supabase
        .from('creator_payouts')
        .update({ status: 'processing' })
        .eq('id', payoutId);

      // Build Flutterwave transfer request
      let transferData: any = {
        account_bank: '',
        account_number: '',
        amount: payout.amount,
        currency: payout.currency,
        reference: `payout_${payoutId}`,
        narration: `Hoyeeh Creator Payout`,
        callback_url: `${supabaseUrl}/functions/v1/creator-payout-webhook`
      };

      const details = payout.payout_details as any;

      if (payout.payout_method === 'mobile_money') {
        transferData = {
          ...transferData,
          account_bank: details.network || 'MTN', // MTN, ORANGE, etc.
          account_number: details.phone_number,
          beneficiary_name: details.account_name || payout.creator_profiles?.display_name
        };
      } else if (payout.payout_method === 'bank_transfer') {
        transferData = {
          ...transferData,
          account_bank: details.bank_code,
          account_number: details.account_number,
          beneficiary_name: details.account_name
        };
      } else if (payout.payout_method === 'paypal') {
        // PayPal payout via Flutterwave
        transferData = {
          ...transferData,
          account_bank: 'PAYPAL',
          account_number: details.paypal_email,
          beneficiary_name: details.account_name || payout.creator_profiles?.display_name,
          meta: [{ Email: details.paypal_email }]
        };
      }

      console.log('Processing Flutterwave transfer:', transferData);

      // Make Flutterwave API call
      const flutterwaveResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(transferData)
      });

      const flutterwaveResult = await flutterwaveResponse.json();

      if (flutterwaveResult.status === 'success') {
        // Update payout with Flutterwave reference
        await supabase
          .from('creator_payouts')
          .update({
            status: 'completed',
            flutterwave_ref: flutterwaveResult.data?.id?.toString(),
            processed_at: new Date().toISOString(),
            approved_by: user.id
          })
          .eq('id', payoutId);

        // Update creator's total_withdrawn
        await supabase
          .from('creator_profiles')
          .update({
            total_withdrawn: (payout.creator_profiles?.total_withdrawn || 0) + payout.amount
          })
          .eq('id', payout.creator_id);

        return new Response(
          JSON.stringify({ success: true, message: 'Payout processed successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Failed - restore balance
        await supabase
          .from('creator_payouts')
          .update({
            status: 'failed',
            error_message: flutterwaveResult.message || 'Transfer failed'
          })
          .eq('id', payoutId);

        await supabase
          .from('creator_profiles')
          .update({
            pending_balance: (payout.creator_profiles?.pending_balance || 0) + payout.amount
          })
          .eq('id', payout.creator_id);

        throw new Error(flutterwaveResult.message || 'Flutterwave transfer failed');
      }
    }

    if (action === 'cancel') {
      // Creator cancels their pending payout
      const { data: payout, error: payoutFetchError } = await supabase
        .from('creator_payouts')
        .select('*')
        .eq('id', payoutId)
        .eq('creator_id', creatorProfile.id)
        .eq('status', 'pending')
        .single();

      if (payoutFetchError || !payout) {
        throw new Error('Pending payout not found');
      }

      // Update payout status
      await supabase
        .from('creator_payouts')
        .update({ status: 'cancelled' })
        .eq('id', payoutId);

      // Restore balance
      await supabase
        .from('creator_profiles')
        .update({
          pending_balance: creatorProfile.pending_balance + payout.amount
        })
        .eq('id', creatorProfile.id);

      return new Response(
        JSON.stringify({ success: true, message: 'Payout cancelled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');
  } catch (error: unknown) {
    console.error('Creator payout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
