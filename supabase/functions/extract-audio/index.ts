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

// Create CloudConvert job that exports directly to S3/DO Spaces
async function createCloudConvertJobWithS3Export(
  apiKey: string,
  videoUrl: string,
  outputFormat: string,
  s3Config: {
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
    endpoint: string;
    key: string;
  }
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
          audio_bitrate: 128,
        },
        "export-audio": {
          operation: "export/s3",
          input: "extract-audio",
          bucket: s3Config.bucket,
          region: s3Config.region,
          endpoint: s3Config.endpoint,
          key: s3Config.key,
          access_key_id: s3Config.accessKey,
          secret_access_key: s3Config.secretKey,
          acl: "public-read",
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
  maxWaitSeconds: number = 600
): Promise<CloudConvertJob> {
  const startTime = Date.now();
  const pollInterval = 3000;

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

    const cloudConvertApiKey = Deno.env.get("CLOUDCONVERT_API_KEY");
    if (!cloudConvertApiKey) {
      console.error("CLOUDCONVERT_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "CloudConvert API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Build the destination path in DO Spaces
    const audioPath = episodeId 
      ? `audio/${contentId}/${episodeId}/audio.${outputFormat}`
      : `audio/${contentId}/audio.${outputFormat}`;

    // Parse endpoint to get the proper format for CloudConvert S3 export
    // DO Spaces endpoint format: https://nyc3.digitaloceanspaces.com
    const endpointUrl = new URL(spacesEndpoint);
    const s3Endpoint = `https://${spacesRegion}.digitaloceanspaces.com`;

    console.log("Creating CloudConvert job with direct S3 export...");
    
    const jobResponse = await createCloudConvertJobWithS3Export(
      cloudConvertApiKey,
      videoUrl,
      outputFormat,
      {
        accessKey: spacesKey,
        secretKey: spacesSecret,
        bucket: spacesBucket,
        region: spacesRegion,
        endpoint: s3Endpoint,
        key: audioPath,
      }
    );

    const jobId = (jobResponse as any).data?.id || jobResponse.id;
    console.log(`CloudConvert job created: ${jobId}`);

    // Wait for job completion
    console.log("Waiting for audio extraction and upload to complete...");
    const completedJob = await waitForCloudConvertJob(cloudConvertApiKey, jobId);
    console.log("CloudConvert job completed successfully");

    // Verify the export task succeeded
    const exportTask = completedJob.tasks.find(t => t.operation === "export/s3");
    if (!exportTask || exportTask.status !== "finished") {
      throw new Error("S3 export task did not complete successfully");
    }

    // Construct URLs
    const publicUrl = `https://${spacesBucket}.${spacesRegion}.digitaloceanspaces.com/${audioPath}`;
    const cdnUrl = spacesCdnEndpoint 
      ? `${spacesCdnEndpoint.replace(/\/$/, '')}/${audioPath}`
      : publicUrl.replace('.digitaloceanspaces.com', '.cdn.digitaloceanspaces.com');

    console.log(`Audio uploaded successfully: ${cdnUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: cdnUrl,
        publicUrl,
        format: outputFormat,
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
