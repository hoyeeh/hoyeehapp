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

// Maximum file size: 50MB (to stay within edge function memory limits)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

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
            details: `Maximum file size is 50MB. Your file is ${(fileSize / 1024 / 1024).toFixed(2)}MB. Please use a smaller audio file or extract audio from the video first.`
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
          details: `Maximum file size is 50MB. Your file is ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB. Please use a smaller audio file or extract audio from the video first.`
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

    // Upload VTT to Supabase Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine storage path
    const subtitlePath = episodeId 
      ? `subtitles/${contentId}/${episodeId}/${languageCode}.vtt`
      : `subtitles/${contentId}/${languageCode}.vtt`;

    console.log(`Uploading VTT to: ${subtitlePath}`);

    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(subtitlePath, vttContent, {
        contentType: "text/vtt",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload subtitle file", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the public URL for the subtitle
    const { data: urlData } = supabase.storage
      .from("videos")
      .getPublicUrl(subtitlePath);

    console.log(`Subtitle uploaded successfully: ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        subtitlePath,
        publicUrl: urlData.publicUrl,
        language: languageCode,
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
