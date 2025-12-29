import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractAudioRequest {
  videoUrl: string;
  contentId: string;
  episodeId?: string;
  outputFormat?: "mp3" | "aac" | "wav";
}

// ============= AWS Signature V4 Helpers (for DO Spaces upload) =============

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return toHex(hash);
}

async function sha256Binary(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return toHex(hash);
}

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

async function uploadToSpaces(
  accessKey: string,
  secretKey: string,
  region: string,
  bucket: string,
  key: string,
  content: Uint8Array,
  contentType: string,
  host: string
): Promise<{ success: boolean; error?: string }> {
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  
  const httpMethod = 'PUT';
  const canonicalUri = `/${key}`;
  const canonicalQueryString = '';
  
  const payloadHash = await sha256Binary(content);
  
  const headers: Record<string, string> = {
    'content-type': contentType,
    'host': host,
    'x-amz-acl': 'public-read',
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  
  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join('');
  const signedHeaders = sortedHeaderKeys.join(';');
  
  const canonicalRequest = [
    httpMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');
  
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = toHex(signatureBuffer);
  
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  const url = `https://${host}${canonicalUri}`;
  
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-amz-acl': 'public-read',
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Authorization': authorization,
      },
      body: content.buffer as ArrayBuffer,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Upload failed: ${response.status} - ${errorText}`);
      return { success: false, error: `Upload failed: ${response.status}` };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============= CloudConvert API for Audio Extraction =============

interface CloudConvertJob {
  id: string;
  status: string;
  tasks: Array<{
    id: string;
    name: string;
    operation: string;
    status: string;
    result?: {
      files?: Array<{
        filename: string;
        url: string;
      }>;
    };
  }>;
}

async function createCloudConvertJob(
  apiKey: string,
  videoUrl: string,
  outputFormat: string
): Promise<CloudConvertJob> {
  const response = await fetch("https://api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tasks: {
        "import-video": {
          operation: "import/url",
          url: videoUrl,
        },
        "extract-audio": {
          operation: "convert",
          input: "import-video",
          output_format: outputFormat,
          audio_codec: outputFormat === "mp3" ? "mp3" : (outputFormat === "aac" ? "aac" : "pcm_s16le"),
          audio_bitrate: 128, // 128 kbps for good quality audio
        },
        "export-audio": {
          operation: "export/url",
          input: "extract-audio",
          inline: false,
          archive_multiple_files: false,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`CloudConvert job creation failed: ${response.status} - ${errorText}`);
    throw new Error(`CloudConvert job creation failed: ${response.status}`);
  }

  return await response.json() as { data: CloudConvertJob } & CloudConvertJob;
}

async function waitForCloudConvertJob(
  apiKey: string,
  jobId: string,
  maxWaitSeconds: number = 300
): Promise<CloudConvertJob> {
  const startTime = Date.now();
  const pollInterval = 3000; // 3 seconds

  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const response = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check job status: ${response.status}`);
    }

    const result = await response.json() as { data: CloudConvertJob };
    const job = result.data;

    console.log(`Job ${jobId} status: ${job.status}`);

    if (job.status === "finished") {
      return job;
    }

    if (job.status === "error") {
      const errorTask = job.tasks.find(t => t.status === "error");
      throw new Error(`CloudConvert job failed: ${JSON.stringify(errorTask)}`);
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`CloudConvert job timed out after ${maxWaitSeconds} seconds`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, contentId, episodeId, outputFormat = "mp3" } = await req.json() as ExtractAudioRequest;

    if (!videoUrl || !contentId) {
      return new Response(
        JSON.stringify({ error: "videoUrl and contentId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate CloudConvert API key
    const cloudConvertApiKey = Deno.env.get("CLOUDCONVERT_API_KEY");
    if (!cloudConvertApiKey) {
      console.error("CLOUDCONVERT_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "CloudConvert API key not configured. Please add your CloudConvert API key." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate DO Spaces configuration
    const spacesKey = Deno.env.get('DO_SPACES_KEY');
    const spacesSecret = Deno.env.get('DO_SPACES_SECRET');
    const spacesEndpoint = Deno.env.get('DO_SPACES_ENDPOINT');
    const spacesBucket = Deno.env.get('DO_SPACES_BUCKET');
    const spacesRegion = Deno.env.get('DO_SPACES_REGION') || 'nyc3';
    const spacesCdnEndpoint = Deno.env.get('DO_SPACES_CDN_ENDPOINT');

    if (!spacesKey || !spacesSecret || !spacesEndpoint || !spacesBucket) {
      console.error('Missing DigitalOcean Spaces configuration');
      return new Response(
        JSON.stringify({ error: 'Storage configuration missing' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting audio extraction for content: ${contentId}, episode: ${episodeId || 'N/A'}`);
    console.log(`Video URL: ${videoUrl}`);
    console.log(`Output format: ${outputFormat}`);

    // Step 1: Create CloudConvert job
    console.log("Creating CloudConvert job...");
    const jobResponse = await createCloudConvertJob(cloudConvertApiKey, videoUrl, outputFormat);
    const jobId = (jobResponse as any).data?.id || jobResponse.id;
    console.log(`CloudConvert job created: ${jobId}`);

    // Step 2: Wait for job completion
    console.log("Waiting for audio extraction to complete...");
    const completedJob = await waitForCloudConvertJob(cloudConvertApiKey, jobId);
    console.log("CloudConvert job completed successfully");

    // Step 3: Get the exported audio URL
    const exportTask = completedJob.tasks.find(t => t.operation === "export/url");
    if (!exportTask?.result?.files?.[0]?.url) {
      throw new Error("No audio file URL in CloudConvert result");
    }

    const tempAudioUrl = exportTask.result.files[0].url;
    console.log(`Temporary audio URL: ${tempAudioUrl}`);

    // Step 4: Download the audio file
    console.log("Downloading extracted audio...");
    const audioResponse = await fetch(tempAudioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download extracted audio: ${audioResponse.status}`);
    }

    const audioData = new Uint8Array(await audioResponse.arrayBuffer());
    console.log(`Audio file downloaded, size: ${(audioData.length / 1024 / 1024).toFixed(2)} MB`);

    // Step 5: Upload to DO Spaces
    const audioPath = episodeId 
      ? `audio/${contentId}/${episodeId}/audio.${outputFormat}`
      : `audio/${contentId}/audio.${outputFormat}`;

    console.log(`Uploading audio to DO Spaces: ${audioPath}`);

    const endpointUrl = new URL(spacesEndpoint);
    const host = `${spacesBucket}.${endpointUrl.host}`;

    const contentTypeMap: Record<string, string> = {
      "mp3": "audio/mpeg",
      "aac": "audio/aac",
      "wav": "audio/wav",
    };

    const uploadResult = await uploadToSpaces(
      spacesKey,
      spacesSecret,
      spacesRegion,
      spacesBucket,
      audioPath,
      audioData,
      contentTypeMap[outputFormat] || "audio/mpeg",
      host
    );

    if (!uploadResult.success) {
      console.error("DO Spaces upload error:", uploadResult.error);
      return new Response(
        JSON.stringify({ error: "Failed to upload audio file", details: uploadResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construct URLs
    const publicUrl = `https://${host}/${audioPath}`;
    const cdnUrl = spacesCdnEndpoint 
      ? `${spacesCdnEndpoint.replace(/\/$/, '')}/${audioPath}`
      : publicUrl.replace('.digitaloceanspaces.com', '.cdn.digitaloceanspaces.com');

    console.log(`Audio uploaded successfully: ${cdnUrl}`);

    // Optionally store the audio reference in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log this extraction for tracking
    console.log(`Audio extraction completed. Original video: ${videoUrl}, Audio: ${cdnUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: cdnUrl,
        publicUrl,
        format: outputFormat,
        fileSizeMb: (audioData.length / 1024 / 1024).toFixed(2),
        contentId,
        episodeId,
        message: "Audio extracted successfully. Use this audio URL for subtitle generation.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in extract-audio function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
