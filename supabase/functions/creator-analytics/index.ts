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
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { action, creatorId, startDate, endDate } = await req.json();
    console.log("Analytics request:", { action, creatorId, startDate, endDate });

    if (action === "aggregate-daily") {
      // This would typically run as a cron job
      // Aggregate daily stats for all creators

      const today = new Date().toISOString().split("T")[0];

      // Get all active creators
      const { data: creators } = await supabaseClient
        .from("creator_profiles")
        .select("id")
        .eq("is_active", true);

      if (!creators) {
        return new Response(
          JSON.stringify({ success: true, message: "No creators to process" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const creator of creators) {
        // Get today's sales
        const { data: todaySales } = await supabaseClient
          .from("content_purchases")
          .select("amount, creator_share")
          .eq("creator_id", creator.id)
          .eq("status", "completed")
          .gte("created_at", `${today}T00:00:00`)
          .lt("created_at", `${today}T23:59:59`);

        // Get today's tips
        const { data: todayTips } = await supabaseClient
          .from("creator_tips")
          .select("amount")
          .eq("creator_id", creator.id)
          .eq("status", "completed")
          .gte("created_at", `${today}T00:00:00`)
          .lt("created_at", `${today}T23:59:59`);

        // Get today's new followers
        const { data: newFollowers } = await supabaseClient
          .from("creator_followers")
          .select("id")
          .eq("creator_id", creator.id)
          .gte("followed_at", `${today}T00:00:00`)
          .lt("followed_at", `${today}T23:59:59`);

        const revenue = (todaySales || []).reduce((sum, s) => sum + Number(s.creator_share), 0);
        const tips = (todayTips || []).reduce((sum, t) => sum + Number(t.amount), 0);

        // Upsert daily analytics
        await supabaseClient
          .from("creator_analytics")
          .upsert({
            creator_id: creator.id,
            date: today,
            views: 0, // Would need view tracking
            unique_viewers: 0,
            watch_time_minutes: 0,
            new_followers: newFollowers?.length || 0,
            sales: todaySales?.length || 0,
            revenue,
            tips_received: tips,
          }, { onConflict: "creator_id,date" });
      }

      return new Response(
        JSON.stringify({ success: true, message: `Processed ${creators.length} creators` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-analytics") {
      // Get analytics for a specific creator and date range
      const { data: analytics, error } = await supabaseClient
        .from("creator_analytics")
        .select("*")
        .eq("creator_id", creatorId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (error) throw error;

      // Calculate totals
      const totals = (analytics || []).reduce(
        (acc, day) => ({
          views: acc.views + day.views,
          uniqueViewers: acc.uniqueViewers + day.unique_viewers,
          watchTimeMinutes: acc.watchTimeMinutes + day.watch_time_minutes,
          newFollowers: acc.newFollowers + day.new_followers,
          sales: acc.sales + day.sales,
          revenue: acc.revenue + Number(day.revenue),
          tipsReceived: acc.tipsReceived + Number(day.tips_received),
        }),
        {
          views: 0,
          uniqueViewers: 0,
          watchTimeMinutes: 0,
          newFollowers: 0,
          sales: 0,
          revenue: 0,
          tipsReceived: 0,
        }
      );

      return new Response(
        JSON.stringify({ success: true, analytics, totals }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-top-content") {
      // Get top performing content for a creator
      const { data: content, error } = await supabaseClient
        .from("paid_content")
        .select("*, content(title, thumbnail_url)")
        .eq("creator_id", creatorId)
        .order("sale_count", { ascending: false })
        .limit(10);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Analytics error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
