import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubtitleRequest {
  contentId: string;
  episodeId?: string;
  audioUrl: string;
  languageCode?: string; // ISO 639-3 code, defaults to 'fra' for French
}

// Language code to label mapping
const LANGUAGE_LABELS: Record<string, string> = {
  fra: "French",
  eng: "English",
  spa: "Spanish",
  ara: "Arabic",
  deu: "German",
  ita: "Italian",
  por: "Portuguese",
  hin: "Hindi",
  zho: "Chinese",
  jpn: "Japanese",
};

// ============= AWS Signature V4 Helpers =============

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

// SHA-256 hash for binary data
async function sha256Binary(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
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

// Upload file directly to DO Spaces using AWS Signature V4
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
  
  // Create canonical request for PUT
  const httpMethod = 'PUT';
  const canonicalUri = `/${key}`;
  const canonicalQueryString = '';
  
  // Calculate payload hash
  const payloadHash = await sha256Binary(content);
  
  // Headers (must be sorted by lowercase name)
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
  
  // Create authorization header
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  // Make the PUT request
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

// ============= VTT Generation Helpers =============

// Convert seconds to VTT timestamp format (HH:MM:SS.mmm)
function formatVttTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toFixed(3).padStart(6, "0")}`;
}

// Convert ElevenLabs transcription response to VTT format
function convertToVtt(words: Array<{ text: string; start: number; end: number }>): string {
  if (!words || words.length === 0) {
    return "WEBVTT\n\n";
  }

  let vttContent = "WEBVTT\n\n";
  let cueIndex = 1;
  let currentCueWords: string[] = [];
  let cueStart = words[0].start;
  let cueEnd = words[0].end;
  
  // Group words into subtitle cues (max ~10 words or 5 seconds per cue)
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentCueWords.push(word.text);
    cueEnd = word.end;
    
    const cueDuration = cueEnd - cueStart;
    const shouldBreak = 
      currentCueWords.length >= 10 || 
      cueDuration >= 5 ||
      (i < words.length - 1 && words[i + 1].start - cueEnd > 0.5);
    
    if (shouldBreak || i === words.length - 1) {
      vttContent += `${cueIndex}\n`;
      vttContent += `${formatVttTimestamp(cueStart)} --> ${formatVttTimestamp(cueEnd)}\n`;
      vttContent += `${currentCueWords.join(" ")}\n\n`;
      
      cueIndex++;
      currentCueWords = [];
      if (i < words.length - 1) {
        cueStart = words[i + 1].start;
      }
    }
  }
  
  return vttContent;
}

// Maximum file size: 500MB (increased for audio files extracted from videos)
// For video files larger than this, use the extract-audio function first
const MAX_FILE_SIZE = 500 * 1024 * 1024;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentId, episodeId, audioUrl, languageCode = "fra" } = await req.json() as SubtitleRequest;

    if (!contentId || !audioUrl) {
      return new Response(
        JSON.stringify({ error: "contentId and audioUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting subtitle generation for content: ${contentId}, language: ${languageCode}`);
    console.log(`Audio URL: ${audioUrl}`);

    // First, do a HEAD request to check file size without downloading
    const headResponse = await fetch(audioUrl, { method: "HEAD" });
    const contentLength = headResponse.headers.get("content-length");
    
    if (contentLength) {
      const fileSize = parseInt(contentLength, 10);
      console.log(`File size from HEAD: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      
      if (fileSize > MAX_FILE_SIZE) {
        console.error(`File too large: ${fileSize} bytes exceeds ${MAX_FILE_SIZE} bytes limit`);
        return new Response(
          JSON.stringify({ 
            error: "File too large for subtitle generation", 
            details: `Maximum file size is 500MB. Your file is ${(fileSize / 1024 / 1024).toFixed(2)}MB. Please extract audio from the video first using the "Extract Audio" feature, which will create a much smaller audio file suitable for subtitle generation.`,
            suggestExtractAudio: true
          }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error(`Failed to fetch audio: ${audioResponse.status}`);
      return new Response(
        JSON.stringify({ error: "Failed to fetch audio file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBlob = await audioResponse.blob();
    console.log(`Audio file fetched, size: ${audioBlob.size} bytes (${(audioBlob.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Double-check size after download (in case HEAD didn't return content-length)
    if (audioBlob.size > MAX_FILE_SIZE) {
      console.error(`File too large after download: ${audioBlob.size} bytes`);
      return new Response(
        JSON.stringify({ 
          error: "File too large for subtitle generation", 
          details: `Maximum file size is 500MB. Your file is ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB. Please extract audio from the video first using the "Extract Audio" feature.`,
          suggestExtractAudio: true
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare form data for ElevenLabs Scribe API
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.mp4");
    formData.append("model_id", "scribe_v1");
    formData.append("language_code", languageCode);
    formData.append("tag_audio_events", "false");
    formData.append("diarize", "false");

    console.log("Calling ElevenLabs Speech-to-Text API...");

    // Call ElevenLabs Speech-to-Text API
    const transcriptionResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error(`ElevenLabs API error: ${transcriptionResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Transcription failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcription = await transcriptionResponse.json();
    console.log(`Transcription completed, words count: ${transcription.words?.length || 0}`);

    // Convert to VTT format
    const vttContent = convertToVtt(transcription.words || []);
    console.log(`VTT generated, length: ${vttContent.length} characters`);

    // Determine storage path for DO Spaces
    const subtitlePath = episodeId 
      ? `subtitles/${contentId}/${episodeId}/${languageCode}.vtt`
      : `subtitles/${contentId}/${languageCode}.vtt`;

    console.log(`Uploading VTT to DO Spaces: ${subtitlePath}`);

    // Parse the endpoint to get the host
    const endpointUrl = new URL(spacesEndpoint);
    const host = `${spacesBucket}.${endpointUrl.host}`;

    // Convert VTT content to Uint8Array
    const encoder = new TextEncoder();
    const vttBytes = encoder.encode(vttContent);

    // Upload to DO Spaces
    const uploadResult = await uploadToSpaces(
      spacesKey,
      spacesSecret,
      spacesRegion,
      spacesBucket,
      subtitlePath,
      vttBytes,
      'text/vtt',
      host
    );

    if (!uploadResult.success) {
      console.error("DO Spaces upload error:", uploadResult.error);
      return new Response(
        JSON.stringify({ error: "Failed to upload subtitle file", details: uploadResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construct URLs
    const publicUrl = `https://${host}/${subtitlePath}`;
    const cdnUrl = spacesCdnEndpoint 
      ? `${spacesCdnEndpoint.replace(/\/$/, '')}/${subtitlePath}`
      : publicUrl.replace('.digitaloceanspaces.com', '.cdn.digitaloceanspaces.com');

    console.log(`Subtitle uploaded successfully to DO Spaces: ${cdnUrl}`);

    // Save subtitle record to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const languageLabel = LANGUAGE_LABELS[languageCode] || languageCode;

    // Upsert subtitle record (update if exists, insert if not)
    const { error: dbError } = await supabase
      .from("subtitles")
      .upsert({
        content_id: contentId,
        episode_id: episodeId || null,
        language_code: languageCode,
        language_label: languageLabel,
        subtitle_url: publicUrl,
        cdn_url: cdnUrl,
        word_count: transcription.words?.length || 0,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'content_id,episode_id,language_code',
      });

    if (dbError) {
      console.error("Failed to save subtitle record:", dbError);
      // Don't fail the request, the file was uploaded successfully
    } else {
      console.log("Subtitle record saved to database");
    }

    return new Response(
      JSON.stringify({
        success: true,
        subtitlePath,
        publicUrl,
        cdnUrl,
        language: languageCode,
        languageLabel,
        wordCount: transcription.words?.length || 0,
        fullText: transcription.text || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-subtitles function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
