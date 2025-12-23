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

    // Get creator profile
    const { data: creatorProfile, error: profileError } = await supabase
      .from('creator_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError || !creatorProfile) {
      throw new Error('Creator profile not found');
    }

    // Get paid content with stats
    const { data: paidContent } = await supabase
      .from('paid_content')
      .select('*, content(id, title, thumbnail_url, content_type)')
      .eq('creator_id', creatorProfile.id);

    // Get recent purchases (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentPurchases } = await supabase
      .from('content_purchases')
      .select('*')
      .eq('creator_id', creatorProfile.id)
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    // Get all-time purchases
    const { data: allPurchases } = await supabase
      .from('content_purchases')
      .select('*')
      .eq('creator_id', creatorProfile.id)
      .eq('status', 'completed');

    // Get payout history
    const { data: payouts } = await supabase
      .from('creator_payouts')
      .select('*')
      .eq('creator_id', creatorProfile.id)
      .order('requested_at', { ascending: false })
      .limit(10);

    // Calculate stats
    const totalSales = allPurchases?.length || 0;
    const recentSales = recentPurchases?.length || 0;
    const recentEarnings = recentPurchases?.reduce((sum, p) => sum + Number(p.creator_share), 0) || 0;

    // Group purchases by day for chart
    const salesByDay: Record<string, { sales: number; earnings: number }> = {};
    (recentPurchases || []).forEach(purchase => {
      const day = new Date(purchase.created_at).toISOString().split('T')[0];
      if (!salesByDay[day]) {
        salesByDay[day] = { sales: 0, earnings: 0 };
      }
      salesByDay[day].sales += 1;
      salesByDay[day].earnings += Number(purchase.creator_share);
    });

    // Top performing content
    const contentStats = (paidContent || []).map(pc => ({
      id: pc.content_id,
      title: pc.content?.title,
      thumbnail: pc.content?.thumbnail_url,
      contentType: pc.content?.content_type,
      price: pc.price,
      sales: pc.sale_count,
      revenue: pc.total_revenue
    })).sort((a, b) => b.sales - a.sales);

    return new Response(
      JSON.stringify({
        success: true,
        profile: {
          id: creatorProfile.id,
          displayName: creatorProfile.display_name,
          bio: creatorProfile.bio,
          avatarUrl: creatorProfile.avatar_url,
          isVerified: creatorProfile.is_verified,
          totalEarnings: creatorProfile.total_earnings,
          pendingBalance: creatorProfile.pending_balance,
          totalWithdrawn: creatorProfile.total_withdrawn
        },
        stats: {
          totalSales,
          recentSales,
          recentEarnings,
          totalContent: paidContent?.length || 0,
          salesByDay
        },
        topContent: contentStats.slice(0, 5),
        recentPayouts: payouts
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Creator dashboard stats error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
