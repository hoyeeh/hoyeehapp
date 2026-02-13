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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Admin client for privileged operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check super admin
    const { data: isSuperAdmin } = await adminClient.rpc("is_super_admin", {
      _user_id: userId,
    });

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Super admin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all imported user IDs from audit_logs
    const { data: auditLogs, error: auditError } = await adminClient
      .from("audit_logs")
      .select("resource_id")
      .eq("action", "create")
      .eq("resource_type", "user")
      .filter("details->>action", "eq", "user_import");

    if (auditError) {
      return new Response(
        JSON.stringify({ error: "Failed to query audit logs", details: auditError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!auditLogs || auditLogs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No imported users found", deleted: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = auditLogs
      .map((log: any) => log.resource_id)
      .filter((id: string | null) => !!id) as string[];

    let deleted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const importedUserId of userIds) {
      try {
        // Delete from related tables
        await adminClient.from("user_roles").delete().eq("user_id", importedUserId);
        await adminClient.from("watchlist").delete().eq("user_id", importedUserId);
        await adminClient.from("watch_history").delete().eq("user_id", importedUserId);
        await adminClient.from("reviews").delete().eq("user_id", importedUserId);
        await adminClient.from("subscriptions").delete().eq("user_id", importedUserId);
        await adminClient.from("push_subscriptions").delete().eq("user_id", importedUserId);
        await adminClient.from("profiles").delete().eq("id", importedUserId);

        // Delete from auth.users
        const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(importedUserId);
        if (deleteAuthError) {
          errors.push(`${importedUserId}: auth delete failed - ${deleteAuthError.message}`);
          failed++;
          continue;
        }

        deleted++;
      } catch (e: any) {
        errors.push(`${importedUserId}: ${e.message}`);
        failed++;
      }
    }

    // Clean up audit log entries for imported users
    await adminClient
      .from("audit_logs")
      .delete()
      .eq("action", "create")
      .eq("resource_type", "user")
      .filter("details->>action", "eq", "user_import");

    return new Response(
      JSON.stringify({
        message: `Deletion complete`,
        total: userIds.length,
        deleted,
        failed,
        errors: errors.slice(0, 20), // Return first 20 errors max
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
