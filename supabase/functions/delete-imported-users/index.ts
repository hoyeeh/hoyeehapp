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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- AuthN: require a valid JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const callerId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // --- AuthZ: require super_admin role ---
    const { data: isSuper, error: roleErr } = await adminClient.rpc("is_super_admin", {
      _user_id: callerId,
    });
    if (roleErr || isSuper !== true) {
      return new Response(
        JSON.stringify({ error: "Forbidden: super_admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get a batch of imported user IDs that have NOT yet been cleaned up
    const { data: auditLogs, error: auditError } = await adminClient
      .from("audit_logs")
      .select("id, resource_id, details")
      .eq("action", "create")
      .eq("resource_type", "user")
      .filter("details->>action", "eq", "user_import")
      .is("details->>cleanup_status", null)
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

    let deleted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const log of auditLogs as Array<{ id: string; resource_id: string | null; details: any }>) {
      const userId = log.resource_id;
      if (!userId) continue;

      let status: "deleted" | "failed" = "failed";
      let errMsg: string | null = null;
      try {
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
        if (deleteError) {
          // If the user is already gone, treat as deleted; otherwise record failure
          if (/not\s*found/i.test(deleteError.message)) {
            status = "deleted";
            deleted++;
          } else {
            errMsg = deleteError.message;
            errors.push(`${userId}: ${deleteError.message}`);
            failed++;
          }
        } else {
          status = "deleted";
          deleted++;
        }
      } catch (e: any) {
        errMsg = e.message;
        errors.push(`${userId}: ${e.message}`);
        failed++;
      }

      // Preserve the audit log; annotate cleanup status so it isn't re-processed.
      const mergedDetails = {
        ...(log.details || {}),
        cleanup_status: status,
        cleanup_at: new Date().toISOString(),
        cleanup_by: callerId,
        ...(errMsg ? { cleanup_error: errMsg } : {}),
      };
      await adminClient
        .from("audit_logs")
        .update({ details: mergedDetails })
        .eq("id", log.id);
    }

    // Write a single audit entry for the batch action by the admin
    await adminClient.from("audit_logs").insert({
      admin_id: callerId,
      action: "delete",
      resource_type: "user",
      resource_id: null,
      details: {
        action: "imported_users_cleanup_batch",
        batch_size: auditLogs.length,
        deleted,
        failed,
        timestamp: new Date().toISOString(),
      },
    });

    // Remaining count (not yet cleaned up)
    const { count } = await adminClient
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "create")
      .eq("resource_type", "user")
      .filter("details->>action", "eq", "user_import")
      .is("details->>cleanup_status", null);

    return new Response(
      JSON.stringify({
        message: "Batch complete",
        batch_size: auditLogs.length,
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
