import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get batch of imported user IDs (process 50 at a time to avoid timeout)
    const { data: auditLogs, error: auditError } = await adminClient
      .from("audit_logs")
      .select("resource_id")
      .eq("action", "create")
      .eq("resource_type", "user")
      .filter("details->>action", "eq", "user_import")
      .limit(50);

    if (auditError) {
      return new Response(
        JSON.stringify({ error: "Failed to query audit logs", details: auditError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!auditLogs || auditLogs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No imported users remaining", deleted: 0, remaining: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = auditLogs
      .map((log: any) => log.resource_id)
      .filter((id: string | null) => !!id) as string[];

    let deleted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
        if (deleteError) {
          errors.push(`${userId}: ${deleteError.message}`);
          failed++;
        } else {
          deleted++;
        }
        // Delete the audit log entry regardless
        await adminClient
          .from("audit_logs")
          .delete()
          .eq("resource_id", userId)
          .eq("action", "create")
          .eq("resource_type", "user")
          .filter("details->>action", "eq", "user_import");
      } catch (e: any) {
        errors.push(`${userId}: ${e.message}`);
        failed++;
      }
    }

    // Count remaining
    const { count } = await adminClient
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "create")
      .eq("resource_type", "user")
      .filter("details->>action", "eq", "user_import");

    return new Response(
      JSON.stringify({
        message: `Batch complete`,
        batch_size: userIds.length,
        deleted,
        failed,
        remaining: count || 0,
        errors: errors.slice(0, 10),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
