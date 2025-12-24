import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const { action, creatorId, reportType } = await req.json();
    console.log("Report request:", { action, creatorId, reportType });

    if (action === "generate-weekly") {
      // Calculate date range for last week
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() - 1); // Yesterday
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6); // 7 days ago

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // Get creators to process (either specific or all)
      let creators;
      if (creatorId) {
        const { data } = await supabaseClient
          .from("creator_profiles")
          .select("id, display_name, user_id")
          .eq("id", creatorId)
          .eq("is_active", true);
        creators = data;
      } else {
        const { data } = await supabaseClient
          .from("creator_profiles")
          .select("id, display_name, user_id")
          .eq("is_active", true);
        creators = data;
      }

      if (!creators || creators.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No creators to process" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const reports = [];

      for (const creator of creators) {
        // Get analytics for the period
        const { data: analytics } = await supabaseClient
          .from("creator_analytics")
          .select("*")
          .eq("creator_id", creator.id)
          .gte("date", startDateStr)
          .lte("date", endDateStr);

        // Get sales details
        const { data: sales } = await supabaseClient
          .from("content_purchases")
          .select("amount, creator_share, content(title)")
          .eq("creator_id", creator.id)
          .eq("status", "completed")
          .gte("created_at", `${startDateStr}T00:00:00`)
          .lte("created_at", `${endDateStr}T23:59:59`);

        // Get tips
        const { data: tips } = await supabaseClient
          .from("creator_tips")
          .select("amount, message")
          .eq("creator_id", creator.id)
          .eq("status", "completed")
          .gte("created_at", `${startDateStr}T00:00:00`)
          .lte("created_at", `${endDateStr}T23:59:59`);

        // Get new followers
        const { data: followers } = await supabaseClient
          .from("creator_followers")
          .select("id")
          .eq("creator_id", creator.id)
          .gte("followed_at", `${startDateStr}T00:00:00`)
          .lte("followed_at", `${endDateStr}T23:59:59`);

        const reportData = {
          period: { start: startDateStr, end: endDateStr },
          summary: {
            totalViews: (analytics || []).reduce((sum, a) => sum + a.views, 0),
            totalSales: sales?.length || 0,
            totalRevenue: (sales || []).reduce((sum, s) => sum + Number(s.creator_share), 0),
            totalTips: (tips || []).reduce((sum, t) => sum + Number(t.amount), 0),
            newFollowers: followers?.length || 0,
          },
          dailyBreakdown: analytics || [],
          topSales: (sales || []).slice(0, 5),
          recentTips: (tips || []).slice(0, 5),
        };

        // Save report
        const { data: report, error: reportError } = await supabaseClient
          .from("creator_reports")
          .insert({
            creator_id: creator.id,
            report_type: "weekly",
            period_start: startDateStr,
            period_end: endDateStr,
            report_data: reportData,
          })
          .select()
          .single();

        if (reportError) {
          console.error("Error saving report:", reportError);
          continue;
        }

        // Send email if Resend is configured
        if (resend) {
          try {
            const { data: userData } = await supabaseClient.auth.admin.getUserById(creator.user_id);
            const email = userData?.user?.email;

            if (email) {
              await resend.emails.send({
                from: "Hoyeeh <reports@hoyeeh.com>",
                to: [email],
                subject: `Your Weekly Report - ${startDateStr} to ${endDateStr}`,
                html: `
                  <h1>Weekly Report for ${creator.display_name}</h1>
                  <p>Here's your performance summary for the week:</p>
                  <ul>
                    <li><strong>Total Sales:</strong> ${reportData.summary.totalSales}</li>
                    <li><strong>Revenue:</strong> ${reportData.summary.totalRevenue} XAF</li>
                    <li><strong>Tips Received:</strong> ${reportData.summary.totalTips} XAF</li>
                    <li><strong>New Followers:</strong> ${reportData.summary.newFollowers}</li>
                  </ul>
                  <p>Log in to your dashboard to see the full report.</p>
                `,
              });

              await supabaseClient
                .from("creator_reports")
                .update({ email_sent_at: new Date().toISOString() })
                .eq("id", report.id);
            }
          } catch (emailError) {
            console.error("Error sending email:", emailError);
          }
        }

        reports.push(report);
      }

      return new Response(
        JSON.stringify({ success: true, reports: reports.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-reports") {
      const { data: reports, error } = await supabaseClient
        .from("creator_reports")
        .select("*")
        .eq("creator_id", creatorId)
        .order("generated_at", { ascending: false })
        .limit(12);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, reports }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Report error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
