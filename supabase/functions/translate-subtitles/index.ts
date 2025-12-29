import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranslateRequest {
  sourceSubtitleId: string;
  targetLanguageCode: string;
  targetLanguageLabel: string;
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

// Parse VTT content into cues
function parseVtt(vttContent: string): VttCue[] {
  const lines = vttContent.split("\n");
  const cues: VttCue[] = [];
  let currentCue: Partial<VttCue> = {};
  let cueIndex = 0;
  let textLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip WEBVTT header and empty lines at start
    if (line === "WEBVTT" || line.startsWith("NOTE") || line.startsWith("STYLE")) {
      continue;
    }

    // Timestamp line
    if (line.includes("-->")) {
      const [startTime, endTime] = line.split("-->").map(t => t.trim());
      currentCue = {
        index: cueIndex++,
        startTime,
        endTime: endTime.split(" ")[0], // Remove any position info
      };
      textLines = [];
    }
    // Empty line - save current cue
    else if (line === "" && currentCue.startTime) {
      if (textLines.length > 0) {
        currentCue.text = textLines.join("\n");
        cues.push(currentCue as VttCue);
      }
      currentCue = {};
      textLines = [];
    }
    // Text line
    else if (currentCue.startTime && line && !line.match(/^\d+$/)) {
      textLines.push(line);
    }
  }

  // Handle last cue if no trailing empty line
  if (currentCue.startTime && textLines.length > 0) {
    currentCue.text = textLines.join("\n");
    cues.push(currentCue as VttCue);
  }

  return cues;
}

// Convert cues back to VTT format
function cuesToVtt(cues: VttCue[]): string {
  let vtt = "WEBVTT\n\n";
  
  for (const cue of cues) {
    vtt += `${cue.startTime} --> ${cue.endTime}\n`;
    vtt += `${cue.text}\n\n`;
  }
  
  return vtt;
}

// Upload to DigitalOcean Spaces
async function uploadToSpaces(
  content: string,
  filename: string
): Promise<string> {
  const endpoint = Deno.env.get("DO_SPACES_ENDPOINT");
  const bucket = Deno.env.get("DO_SPACES_BUCKET");
  const region = Deno.env.get("DO_SPACES_REGION") || "nyc3";
  const accessKey = Deno.env.get("DO_SPACES_KEY");
  const secretKey = Deno.env.get("DO_SPACES_SECRET");
  const cdnEndpoint = Deno.env.get("DO_SPACES_CDN_ENDPOINT");

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("DigitalOcean Spaces credentials not configured");
  }

  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);
  const contentType = "text/vtt";
  const key = `subtitles/${filename}`;
  const date = new Date().toUTCString();
  const host = `${bucket}.${region}.digitaloceanspaces.com`;
  
  // Simple AWS Signature for PUT
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

  // Return CDN URL if available, otherwise direct URL
  if (cdnEndpoint) {
    return `${cdnEndpoint}/${key}`;
  }
  return `https://${host}/${key}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      sourceSubtitleId, 
      targetLanguageCode, 
      targetLanguageLabel,
      contentId,
      episodeId,
      title 
    }: TranslateRequest = await req.json();

    console.log(`Translating subtitle ${sourceSubtitleId} to ${targetLanguageLabel}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get source subtitle
    const { data: sourceSubtitle, error: fetchError } = await supabase
      .from("subtitles")
      .select("*")
      .eq("id", sourceSubtitleId)
      .single();

    if (fetchError || !sourceSubtitle) {
      throw new Error("Source subtitle not found");
    }

    // Fetch VTT content
    const subtitleUrl = sourceSubtitle.cdn_url || sourceSubtitle.subtitle_url;
    const vttResponse = await fetch(subtitleUrl);
    if (!vttResponse.ok) {
      throw new Error("Failed to fetch source subtitle file");
    }
    const vttContent = await vttResponse.text();

    // Parse VTT
    const cues = parseVtt(vttContent);
    console.log(`Parsed ${cues.length} cues from source subtitle`);

    if (cues.length === 0) {
      throw new Error("No subtitle cues found in source file");
    }

    // Prepare text for translation (batch cues to reduce API calls)
    const BATCH_SIZE = 50;
    const translatedCues: VttCue[] = [];
    
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    for (let i = 0; i < cues.length; i += BATCH_SIZE) {
      const batch = cues.slice(i, i + BATCH_SIZE);
      const textsToTranslate = batch.map((c, idx) => `[${idx}] ${c.text}`).join("\n");
      
      // Call Lovable AI for translation
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a professional subtitle translator. Translate the following subtitle lines from ${sourceSubtitle.language_label} to ${targetLanguageLabel}. 
              
IMPORTANT RULES:
1. Keep the [index] prefix for each line
2. Preserve any HTML tags like <i>, <b>, etc.
3. Keep translations concise (subtitles should be readable quickly)
4. Maintain the same number of lines
5. Do not add explanations, just output the translations

Example input:
[0] Hello, how are you?
[1] I'm fine, thank you.

Example output:
[0] Bonjour, comment allez-vous ?
[1] Je vais bien, merci.`
            },
            {
              role: "user",
              content: textsToTranslate
            }
          ],
          temperature: 0.3,
        })
      });

      if (!aiResponse.ok) {
        const error = await aiResponse.text();
        console.error("AI translation error:", error);
        throw new Error(`Translation failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const translatedText = aiData.choices?.[0]?.message?.content || "";
      
      // Parse translated lines
      const translatedLines = translatedText.split("\n").filter((l: string) => l.trim());
      
      for (const cue of batch) {
        const originalIdx = cue.index - (i > 0 ? i : 0);
        const translatedLine = translatedLines.find((l: string) => l.startsWith(`[${batch.indexOf(cue)}]`));
        
        if (translatedLine) {
          // Remove the [index] prefix
          const translatedCueText = translatedLine.replace(/^\[\d+\]\s*/, "").trim();
          translatedCues.push({
            ...cue,
            text: translatedCueText || cue.text // Fallback to original if empty
          });
        } else {
          // Fallback to original text if translation failed for this line
          translatedCues.push(cue);
        }
      }
    }

    console.log(`Translated ${translatedCues.length} cues`);

    // Convert back to VTT
    const translatedVtt = cuesToVtt(translatedCues);
    
    // Generate filename
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const timestamp = Date.now();
    const filename = episodeId 
      ? `${contentId}_${episodeId}_${targetLanguageCode}_${timestamp}.vtt`
      : `${contentId}_${targetLanguageCode}_${timestamp}.vtt`;

    // Upload to Spaces
    const cdnUrl = await uploadToSpaces(translatedVtt, filename);
    console.log(`Uploaded translated subtitle to: ${cdnUrl}`);

    // Count words
    const wordCount = translatedCues.reduce((count, cue) => {
      return count + cue.text.split(/\s+/).filter(w => w.length > 0).length;
    }, 0);

    // Save to database
    const { data: newSubtitle, error: insertError } = await supabase
      .from("subtitles")
      .insert({
        content_id: contentId,
        episode_id: episodeId || null,
        language_code: targetLanguageCode,
        language_label: targetLanguageLabel,
        subtitle_url: cdnUrl,
        cdn_url: cdnUrl,
        word_count: wordCount,
        is_translated: true,
        source_subtitle_id: sourceSubtitleId,
        source_type: "translated"
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error saving subtitle:", insertError);
      throw new Error("Failed to save translated subtitle");
    }

    return new Response(JSON.stringify({
      success: true,
      subtitle: newSubtitle,
      cdnUrl,
      wordCount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Translation error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
