import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to convert ArrayBuffer to hex string
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// SHA-256 hash
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return toHex(hash);
}

// HMAC-SHA256
async function hmacSha256(key: BufferSource, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

// Get AWS signature key
async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256(encoder.encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  return kSigning;
}

// Helper function to create AWS Signature V4 presigned URL
async function createPresignedUrl(
  accessKey: string,
  secretKey: string,
  region: string,
  bucket: string,
  key: string,
  contentType: string,
  host: string,
  expiresIn: number = 3600
): Promise<string> {
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${accessKey}/${credentialScope}`;
  
  // Create canonical request
  const httpMethod = 'PUT';
  const canonicalUri = `/${key}`;
  
  // Query parameters for presigned URL (must be sorted)
  const queryParams: [string, string][] = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', expiresIn.toString()],
    ['X-Amz-SignedHeaders', 'content-type;host;x-amz-acl'],
  ];
  
  const canonicalQueryString = queryParams
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-acl:public-read\n`;
  const signedHeaders = 'content-type;host;x-amz-acl';
  
  // For presigned URLs, the payload hash is UNSIGNED-PAYLOAD
  const payloadHash = 'UNSIGNED-PAYLOAD';
  
  const canonicalRequest = [
    httpMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  // Create string to sign
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');
  
  // Calculate signature
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = toHex(signatureBuffer);
  
  // Build presigned URL
  const presignedUrl = `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  
  return presignedUrl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid token:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is an admin
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      console.error('User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const spacesKey = Deno.env.get('DO_SPACES_KEY');
    const spacesSecret = Deno.env.get('DO_SPACES_SECRET');
    const spacesEndpoint = Deno.env.get('DO_SPACES_ENDPOINT');
    const spacesBucket = Deno.env.get('DO_SPACES_BUCKET');
    const spacesRegion = Deno.env.get('DO_SPACES_REGION') || 'nyc3';

    if (!spacesKey || !spacesSecret || !spacesEndpoint || !spacesBucket) {
      console.error('Missing DigitalOcean Spaces configuration');
      return new Response(
        JSON.stringify({ error: 'Storage configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileName, fileType, folder = 'episodes' } = await req.json();

    if (!fileName || !fileType) {
      return new Response(
        JSON.stringify({ error: 'fileName and fileType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type (allow video and image files)
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/ogg'];
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const isVideo = fileType.startsWith('video/') || allowedVideoTypes.includes(fileType);
    const isImage = allowedImageTypes.includes(fileType);
    
    if (!isVideo && !isImage) {
      console.error('Invalid file type:', fileType);
      return new Response(
        JSON.stringify({ error: 'Only video and image files are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} generating presigned URL for: ${folder}/${fileName}`);

    // Generate unique file key
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `${folder}/${timestamp}-${sanitizedFileName}`;

    // Parse the endpoint to get the host
    const endpointUrl = new URL(spacesEndpoint);
    const host = `${spacesBucket}.${endpointUrl.host}`;

    // Generate presigned URL using AWS Signature V4
    const presignedUrl = await createPresignedUrl(
      spacesKey,
      spacesSecret,
      spacesRegion,
      spacesBucket,
      fileKey,
      fileType,
      host,
      3600 // 1 hour expiry
    );

    // Construct the public URL for the file
    const publicUrl = `https://${host}/${fileKey}`;

    console.log(`Generated presigned URL for key: ${fileKey}`);

    return new Response(
      JSON.stringify({
        presignedUrl,
        fileKey,
        publicUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error generating presigned URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});