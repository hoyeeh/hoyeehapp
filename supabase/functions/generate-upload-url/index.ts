import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.485.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.485.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log(`Generating presigned URL for: ${folder}/${fileName}`);

    // Create S3 client for DigitalOcean Spaces
    const s3Client = new S3Client({
      endpoint: spacesEndpoint,
      region: spacesRegion,
      credentials: {
        accessKeyId: spacesKey,
        secretAccessKey: spacesSecret,
      },
      forcePathStyle: false,
    });

    // Generate unique file key
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `${folder}/${timestamp}-${sanitizedFileName}`;

    // Create the presigned URL for PUT operation
    const command = new PutObjectCommand({
      Bucket: spacesBucket,
      Key: fileKey,
      ContentType: fileType,
      ACL: 'public-read',
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiry

    // Construct the public URL for the file
    const publicUrl = `${spacesEndpoint}/${spacesBucket}/${fileKey}`;

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
