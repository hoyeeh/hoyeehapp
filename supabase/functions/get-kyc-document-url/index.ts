import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Short-lived URL expiry (15 minutes for document viewing)
const DOCUMENT_URL_EXPIRY_SECONDS = 15 * 60;

interface KYCDocumentRequest {
  creatorId: string;
  documentPath?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client info for audit logging
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is a super admin (only super admins can access KYC documents)
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      console.error("Roles fetch error:", rolesError);
      return new Response(
        JSON.stringify({ error: "Could not verify permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuperAdmin = roles?.some(r => r.role === "super_admin");
    
    if (!isSuperAdmin) {
      console.warn(`Unauthorized KYC access attempt by user ${user.id}`);
      return new Response(
        JSON.stringify({ error: "Super Admin access required for KYC documents" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { creatorId, documentPath } = await req.json() as KYCDocumentRequest;

    if (!creatorId) {
      return new Response(
        JSON.stringify({ error: "Creator ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Super admin ${user.id} requesting KYC document for creator ${creatorId}`);

    // Fetch KYC record to get document path and log access
    const { data: kyc, error: kycError } = await supabase
      .from("creator_kyc")
      .select("id, id_document_url, creator_id")
      .eq("creator_id", creatorId)
      .maybeSingle();

    if (kycError) {
      console.error("KYC fetch error:", kycError);
      return new Response(
        JSON.stringify({ error: "Could not fetch KYC record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!kyc) {
      return new Response(
        JSON.stringify({ error: "KYC record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the access attempt to audit table
    const { error: logError } = await supabase
      .from("kyc_access_logs")
      .insert({
        kyc_id: kyc.id,
        creator_id: creatorId,
        accessed_by: user.id,
        action: "view_document",
        ip_address: clientIp,
        user_agent: userAgent,
        details: {
          accessed_fields: ["id_document_url"],
          timestamp: new Date().toISOString(),
        }
      });

    if (logError) {
      console.error("Audit log error:", logError);
      // Don't fail the request, but log the issue
    }

    // Extract the storage path from the URL
    let storagePath = documentPath;
    
    if (!storagePath && kyc.id_document_url) {
      // Parse the existing URL to get the storage path
      // The URL format is typically: https://xxx.supabase.co/storage/v1/object/sign/creator-uploads/user_id/kyc/filename?token=xxx
      const urlMatch = kyc.id_document_url.match(/creator-uploads\/(.+?)(?:\?|$)/);
      if (urlMatch) {
        storagePath = urlMatch[1];
      }
    }

    if (!storagePath) {
      return new Response(
        JSON.stringify({ error: "No document path available" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a new short-lived signed URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("creator-uploads")
      .createSignedUrl(storagePath, DOCUMENT_URL_EXPIRY_SECONDS);

    if (signedUrlError) {
      console.error("Signed URL error:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Could not generate secure document URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generated short-lived KYC document URL for admin ${user.id}, expires in ${DOCUMENT_URL_EXPIRY_SECONDS}s`);

    return new Response(
      JSON.stringify({
        signedUrl: signedUrlData.signedUrl,
        expiresAt: new Date(Date.now() + DOCUMENT_URL_EXPIRY_SECONDS * 1000).toISOString(),
        expiresInSeconds: DOCUMENT_URL_EXPIRY_SECONDS,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store, max-age=0",
        } 
      }
    );

  } catch (error) {
    console.error("Error in get-kyc-document-url:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
