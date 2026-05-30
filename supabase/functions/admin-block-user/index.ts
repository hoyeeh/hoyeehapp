import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BlockUserRequest {
  targetUserId: string;
  block: boolean;
  reason?: string;
}

// 100 years effectively permanent ban
const PERMANENT_BAN_DURATION = "876000h";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user: callerUser }, error: userError } = await supabaseUser.auth.getUser(token);

    if (userError || !callerUser) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Require super_admin or admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isAuthorized = roles?.some((r: any) => r.role === "super_admin" || r.role === "admin");
    if (!isAuthorized) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized: Admin required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body: BlockUserRequest = await req.json();
    const { targetUserId, block, reason } = body;

    if (!targetUserId || typeof block !== "boolean") {
      return new Response(JSON.stringify({ success: false, error: "Missing parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Apply ban via Supabase auth admin API
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      ban_duration: block ? PERMANENT_BAN_DURATION : "none",
    } as any);

    if (banError) {
      console.error("Failed to update ban:", banError);
      return new Response(JSON.stringify({ success: false, error: banError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Mirror state in profiles + invalidate active session so they're kicked out
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_blocked: block,
        blocked_at: block ? new Date().toISOString() : null,
        blocked_reason: block ? (reason || null) : null,
        blocked_by: block ? callerUser.id : null,
        active_session_id: block ? null : undefined,
      })
      .eq("id", targetUserId);

    if (profileError) {
      console.error("Failed to update profile:", profileError);
    }

    // If blocking, also revoke all refresh tokens / sessions
    if (block) {
      try {
        await supabaseAdmin.auth.admin.signOut(targetUserId, "global" as any);
      } catch (e) {
        console.warn("signOut failed (non-fatal):", e);
      }
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      admin_id: callerUser.id,
      action: block ? "block_user" : "unblock_user",
      resource_type: "user",
      resource_id: targetUserId,
      details: {
        target_user_id: targetUserId,
        reason: reason || null,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({ success: true, blocked: block }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in admin-block-user:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
