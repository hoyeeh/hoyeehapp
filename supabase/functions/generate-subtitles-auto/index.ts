import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  videoUrl: string;
  contentId: string;
  episodeId?: string;
  title: string;
}

interface VttCue {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

// Convert seconds to VTT timestamp format (HH:MM:SS.mmm)
function secondsToVttTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}

// Convert Whisper segments to VTT cues
function whisperToVttCues(segments: Array<{ start: number; end: number; text: string }>): VttCue[] {
  return segments.map((seg, idx) => ({
    index: idx,
    startTime: secondsToVttTimestamp(seg.start),
    endTime: secondsToVttTimestamp(seg.end),
    text: seg.text.trim()
  }));
}

// Convert cues to VTT format
function cuesToVtt(cues: VttCue[]): string {
  let vtt = "WEBVTT\n\n";
  for (const cue of cues) {
    vtt += `${cue.startTime} --> ${cue.endTime}\n`;
    vtt += `${cue.text}\n\n`;
  }
  return vtt;
}

// Upload to DigitalOcean Spaces
async function uploadToSpaces(content: string, filename: string): Promise<string> {
  const bucket = Deno.env.get("DO_SPACES_BUCKET");
  const region = Deno.env.get("DO_SPACES_REGION") || "nyc3";
  const accessKey = Deno.env.get("DO_SPACES_KEY");
  const secretKey = Deno.env.get("DO_SPACES_SECRET");
  const cdnEndpoint = Deno.env.get("DO_SPACES_CDN_ENDPOINT");

  if (!bucket || !accessKey || !secretKey) {
    throw new Error("DigitalOcean Spaces credentials not configured");
  }

  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);
  const contentType = "text/vtt";
  const key = `subtitles/${filename}`;
  const date = new Date().toUTCString();
  const host = `${bucket}.${region}.digitaloceanspaces.com`;
  
  const stringToSign = `PUT\n\n${contentType}\n${date}\n/${bucket}/${key}`;
  
  const keyData = encoder.encode(secretKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(stringToSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const response = await fetch(`https://${host}/${key}`, {
    method: "PUT",
    headers: {
      "Host": host,
      "Date": date,
      "Content-Type": contentType,
      "Content-Length": contentBytes.length.toString(),
      "x-amz-acl": "public-read",
      "Authorization": `AWS ${accessKey}:${signatureBase64}`,
    },
    body: contentBytes,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to Spaces: ${error}`);
  }

  if (cdnEndpoint) {
    return `${cdnEndpoint}/${key}`;
  }
  return `https://${host}/${key}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  let logId: string | null = null;

  try {
    const { videoUrl, contentId, episodeId, title }: GenerateRequest = await req.json();
    
    console.log(`Starting auto subtitle generation for: ${title}`);
    console.log(`Content ID: ${contentId}, Episode ID: ${episodeId || 'N/A'}`);

    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from("subtitle_generation_logs")
      .insert({
        content_id: contentId,
        episode_id: episodeId || null,
        video_url: videoUrl,
        status: "pending",
        metadata: { title }
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create log entry:", logError);
    } else {
      logId = logEntry.id;
    }

    // Update status to transcribing
    if (logId) {
      await supabase
        .from("subtitle_generation_logs")
        .update({ status: "transcribing" })
        .eq("id", logId);
    }

    // For HLS streams, we need to extract audio first
    // Check if URL is HLS (.m3u8)
    let audioUrl = videoUrl;
    const isHLS = videoUrl.includes('.m3u8');
    
    if (isHLS) {
      console.log("HLS stream detected, attempting to extract audio...");
      
      // Call extract-audio function to get audio file
      const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-audio`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrl, contentId, episodeId }),
      });

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        console.error("Audio extraction failed:", errorText);
        throw new Error("Failed to extract audio from HLS stream");
      }

      const extractResult = await extractResponse.json();
      if (extractResult.audioUrl) {
        audioUrl = extractResult.audioUrl;
        console.log("Audio extracted successfully:", audioUrl);
      } else {
        console.log("Audio extraction did not return URL, using original video URL");
      }
    }

    // Download audio file for Whisper (max 25MB)
    console.log("Downloading audio for transcription...");
    const audioResponse = await fetch(audioUrl);
    
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    }

    const audioBlob = await audioResponse.blob();
    console.log(`Audio file size: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`);

    // Check file size limit (25MB for Whisper)
    if (audioBlob.size > 25 * 1024 * 1024) {
      throw new Error("Audio file too large for Whisper API (max 25MB). Consider extracting audio first.");
    }

    // Call OpenAI Whisper API
    console.log("Calling OpenAI Whisper API...");
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.mp3");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("language", "en"); // Default to English
    formData.append("timestamp_granularities[]", "segment");

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("Whisper API error:", errorText);
      throw new Error(`Whisper transcription failed: ${whisperResponse.status}`);
    }

    const whisperResult = await whisperResponse.json();
    console.log(`Transcription complete: ${whisperResult.segments?.length || 0} segments`);

    // Check for silent video
    if (!whisperResult.segments || whisperResult.segments.length === 0) {
      console.log("No speech detected in video");
      
      if (logId) {
        await supabase
          .from("subtitle_generation_logs")
          .update({ 
            status: "completed",
            completed_at: new Date().toISOString(),
            metadata: { title, note: "No speech detected - silent video" }
          })
          .eq("id", logId);
      }

      return new Response(JSON.stringify({
        success: true,
        message: "No speech detected in video",
        silentVideo: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get video duration
    const duration = whisperResult.duration || 0;

    // Convert to VTT format
    const cues = whisperToVttCues(whisperResult.segments);
    const vttContent = cuesToVtt(cues);

    // Generate filename and upload English VTT
    const timestamp = Date.now();
    const engFilename = episodeId 
      ? `${contentId}_${episodeId}_eng_${timestamp}.vtt`
      : `${contentId}_eng_${timestamp}.vtt`;

    console.log("Uploading English VTT...");
    const engCdnUrl = await uploadToSpaces(vttContent, engFilename);
    console.log("English VTT uploaded:", engCdnUrl);

    // Calculate word count
    const wordCount = cues.reduce((count, cue) => {
      return count + cue.text.split(/\s+/).filter(w => w.length > 0).length;
    }, 0);

    // Save English subtitle to database
    const { data: engSubtitle, error: engError } = await supabase
      .from("subtitles")
      .insert({
        content_id: contentId,
        episode_id: episodeId || null,
        language_code: "eng",
        language_label: "English",
        subtitle_url: engCdnUrl,
        cdn_url: engCdnUrl,
        word_count: wordCount,
        is_translated: false,
        source_type: "whisper"
      })
      .select()
      .single();

    if (engError) {
      console.error("Failed to save English subtitle:", engError);
      throw new Error("Failed to save English subtitle to database");
    }

    console.log("English subtitle saved with ID:", engSubtitle.id);

    // Update log status
    if (logId) {
      await supabase
        .from("subtitle_generation_logs")
        .update({ 
          status: "translating",
          video_duration_seconds: duration,
          languages_generated: ["eng"]
        })
        .eq("id", logId);
    }

    // Trigger French translation using existing translate-subtitles function
    console.log("Triggering French translation...");
    try {
      const translateResponse = await fetch(`${supabaseUrl}/functions/v1/translate-subtitles`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceSubtitleId: engSubtitle.id,
          targetLanguageCode: "fra",
          targetLanguageLabel: "Français",
          contentId,
          episodeId: episodeId || undefined,
          title
        }),
      });

      if (!translateResponse.ok) {
        const translateError = await translateResponse.text();
        console.error("French translation failed:", translateError);
        // Don't throw - we still have English subtitles
      } else {
        const translateResult = await translateResponse.json();
        console.log("French translation completed:", translateResult.cdnUrl);

        // Update log with French
        if (logId) {
          await supabase
            .from("subtitle_generation_logs")
            .update({ 
              languages_generated: ["eng", "fra"]
            })
            .eq("id", logId);
        }
      }
    } catch (translateErr) {
      console.error("Translation error:", translateErr);
      // Continue without French - we still have English
    }

    // Mark as completed
    if (logId) {
      await supabase
        .from("subtitle_generation_logs")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", logId);
    }

    console.log("Subtitle generation completed successfully");

    return new Response(JSON.stringify({
      success: true,
      englishSubtitle: {
        id: engSubtitle.id,
        cdnUrl: engCdnUrl,
        wordCount
      },
      duration,
      segmentCount: cues.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Subtitle generation error:", error);

    // Update log with error
    if (logId) {
      await supabase
        .from("subtitle_generation_logs")
        .update({ 
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
          completed_at: new Date().toISOString()
        })
        .eq("id", logId);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
