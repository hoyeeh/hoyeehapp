import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranscodingNotificationRequest {
  jobId: string;
  status: "completed" | "failed";
  episodeTitle?: string;
  showTitle?: string;
  errorMessage?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { jobId, status, episodeTitle, showTitle, errorMessage }: TranscodingNotificationRequest = await req.json();

    // Get all admin users
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      throw rolesError;
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admin users found to notify");
      return new Response(
        JSON.stringify({ success: true, message: "No admins to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get admin emails from auth.users
    const adminEmails: string[] = [];
    for (const role of adminRoles) {
      const { data: userData } = await supabase.auth.admin.getUserById(role.user_id);
      if (userData?.user?.email) {
        adminEmails.push(userData.user.email);
      }
    }

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const isSuccess = status === "completed";
    const subject = isSuccess 
      ? `✅ Transcoding Complete: ${episodeTitle || "Video"}`
      : `❌ Transcoding Failed: ${episodeTitle || "Video"}`;

    const html = isSuccess
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #22c55e;">Transcoding Complete!</h1>
          <p>The following video has been successfully transcoded and is now ready for streaming:</p>
          <div style="background: #f4f4f4; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Show:</strong> ${showTitle || "N/A"}</p>
            <p><strong>Episode:</strong> ${episodeTitle || "N/A"}</p>
            <p><strong>Job ID:</strong> ${jobId}</p>
          </div>
          <p>The video is now available in HLS format with multiple quality levels.</p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #ef4444;">Transcoding Failed</h1>
          <p>The following video encountered an error during transcoding:</p>
          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fee2e2;">
            <p><strong>Show:</strong> ${showTitle || "N/A"}</p>
            <p><strong>Episode:</strong> ${episodeTitle || "N/A"}</p>
            <p><strong>Job ID:</strong> ${jobId}</p>
            <p><strong>Error:</strong> ${errorMessage || "Unknown error"}</p>
          </div>
          <p>Please check the admin dashboard to retry the transcoding or investigate the issue.</p>
        </div>
      `;

    // Send email to all admins using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Hoyeeh <onboarding@resend.dev>",
        to: adminEmails,
        subject,
        html,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in transcoding-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
