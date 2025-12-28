import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const wrapInTemplate = (content: string, subject: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <p style="color: #ff6300; font-size: 36px; font-weight: 700; margin: 0; letter-spacing: -1px;">Hoyeeh</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color: #141414; border-radius: 12px; padding: 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; border-top: 1px solid #333; margin-top: 32px;">
              <p style="color: #666; font-size: 12px; text-align: center; margin: 0 0 8px 0;">
                © ${new Date().getFullYear()} Hoyeeh. All rights reserved.
              </p>
              <p style="color: #666; font-size: 12px; text-align: center; margin: 0;">
                <a href="https://hoyeeh.com" style="color: #ff6300; text-decoration: none;">Visit Hoyeeh</a>
                •
                <a href="https://hoyeeh.com/subscription" style="color: #ff6300; text-decoration: none;">Manage Subscription</a>
                •
                <a href="https://hoyeeh.com/notifications" style="color: #ff6300; text-decoration: none;">Email Preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { campaignId, processScheduled, processDrip } = await req.json();

    // Process a specific campaign
    if (campaignId) {
      console.log(`Processing campaign: ${campaignId}`);

      // Get campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from("email_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (campaignError || !campaign) {
        throw new Error("Campaign not found");
      }

      // Update status to sending
      await supabase
        .from("email_campaigns")
        .update({ status: "sending" })
        .eq("id", campaignId);

      // Get target users based on audience
      let usersQuery = supabase
        .from("profiles")
        .select("id, display_name")
        .not("id", "is", null);

      if (campaign.target_audience === "subscribed") {
        usersQuery = usersQuery.eq("is_subscribed", true);
      } else if (campaign.target_audience === "unsubscribed") {
        usersQuery = usersQuery.eq("is_subscribed", false);
      } else if (campaign.target_audience === "new") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        usersQuery = usersQuery.gte("created_at", sevenDaysAgo.toISOString());
      }

      const { data: profiles, error: profilesError } = await usersQuery;

      if (profilesError) {
        throw new Error("Error fetching users");
      }

      // Get emails from auth.users for these profiles
      const userIds = profiles?.map(p => p.id) || [];
      
      let sentCount = 0;
      let errorCount = 0;

      for (const profile of profiles || []) {
        try {
          // Get user email
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
          
          if (!authUser?.user?.email) continue;

          const htmlContent = wrapInTemplate(
            campaign.html_content || `<p style="color: #e0e0e0; font-size: 16px; line-height: 24px;">${campaign.subject}</p>`,
            campaign.subject
          );

          // Schedule the email
          await supabase.from("scheduled_emails").insert({
            user_id: profile.id,
            recipient_email: authUser.user.email,
            subject: campaign.subject,
            html_content: htmlContent,
            source_type: "campaign",
            source_id: campaignId,
            scheduled_for: campaign.scheduled_at || new Date().toISOString(),
            status: "pending"
          });

          sentCount++;
        } catch (err) {
          console.error(`Error scheduling email for user ${profile.id}:`, err);
          errorCount++;
        }
      }

      // Update campaign status
      await supabase
        .from("email_campaigns")
        .update({
          status: campaign.scheduled_at ? "scheduled" : "sent",
          sent_at: campaign.scheduled_at ? null : new Date().toISOString()
        })
        .eq("id", campaignId);

      console.log(`Campaign processed: ${sentCount} emails scheduled, ${errorCount} errors`);

      return new Response(
        JSON.stringify({ success: true, scheduled: sentCount, errors: errorCount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process scheduled emails queue
    if (processScheduled) {
      console.log("Processing scheduled emails queue");

      const { data: pendingEmails, error: pendingError } = await supabase
        .from("scheduled_emails")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_for", new Date().toISOString())
        .limit(50);

      if (pendingError) {
        throw new Error("Error fetching pending emails");
      }

      let sentCount = 0;
      let errorCount = 0;

      for (const email of pendingEmails || []) {
        try {
          const emailResponse = await resend.emails.send({
            from: "Hoyeeh <notifications@hoyeeh.com>",
            to: [email.recipient_email],
            subject: email.subject,
            html: email.html_content,
          });

          // Log the email
          await supabase.from("email_logs").insert({
            message_id: emailResponse.data?.id || null,
            recipient_email: email.recipient_email,
            template_type: email.source_type,
            subject: email.subject,
            status: "sent",
            user_id: email.user_id,
            sent_at: new Date().toISOString()
          });

          // Update scheduled email status
          await supabase
            .from("scheduled_emails")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", email.id);

          sentCount++;
        } catch (err: any) {
          console.error(`Error sending email ${email.id}:`, err);
          
          await supabase
            .from("scheduled_emails")
            .update({ status: "failed", error_message: err.message })
            .eq("id", email.id);

          errorCount++;
        }
      }

      console.log(`Processed ${sentCount} emails, ${errorCount} errors`);

      return new Response(
        JSON.stringify({ success: true, sent: sentCount, errors: errorCount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process drip sequences
    if (processDrip) {
      console.log("Processing drip sequences");

      // Get enrollments that need emails sent
      const { data: enrollments, error: enrollError } = await supabase
        .from("user_drip_enrollments")
        .select(`
          *,
          drip_sequences!inner(*)
        `)
        .eq("status", "active")
        .lte("next_email_at", new Date().toISOString())
        .limit(50);

      if (enrollError) {
        throw new Error("Error fetching enrollments");
      }

      let processedCount = 0;

      for (const enrollment of enrollments || []) {
        try {
          // Get the next step
          const { data: step, error: stepError } = await supabase
            .from("drip_sequence_steps")
            .select("*")
            .eq("sequence_id", enrollment.sequence_id)
            .eq("step_order", enrollment.current_step + 1)
            .single();

          if (stepError || !step) {
            // No more steps, mark as completed
            await supabase
              .from("user_drip_enrollments")
              .update({
                status: "completed",
                completed_at: new Date().toISOString()
              })
              .eq("id", enrollment.id);
            continue;
          }

          // Get user email
          const { data: authUser } = await supabase.auth.admin.getUserById(enrollment.user_id);
          
          if (!authUser?.user?.email) continue;

          const htmlContent = wrapInTemplate(
            step.html_content || `<p style="color: #e0e0e0;">${step.subject}</p>`,
            step.subject
          );

          // Schedule the email
          await supabase.from("scheduled_emails").insert({
            user_id: enrollment.user_id,
            recipient_email: authUser.user.email,
            subject: step.subject,
            html_content: htmlContent,
            source_type: "drip",
            source_id: enrollment.sequence_id,
            scheduled_for: new Date().toISOString(),
            status: "pending"
          });

          // Calculate next email time
          const nextEmailAt = new Date();
          nextEmailAt.setDate(nextEmailAt.getDate() + (step.delay_days || 0));
          nextEmailAt.setHours(nextEmailAt.getHours() + (step.delay_hours || 0));

          // Update enrollment
          await supabase
            .from("user_drip_enrollments")
            .update({
              current_step: enrollment.current_step + 1,
              next_email_at: nextEmailAt.toISOString()
            })
            .eq("id", enrollment.id);

          processedCount++;
        } catch (err) {
          console.error(`Error processing enrollment ${enrollment.id}:`, err);
        }
      }

      console.log(`Processed ${processedCount} drip enrollments`);

      return new Response(
        JSON.stringify({ success: true, processed: processedCount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "No valid action specified" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error processing campaign:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
