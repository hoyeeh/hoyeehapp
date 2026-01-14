import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mux-signature',
};

// Verify Mux webhook signature using HMAC-SHA256
async function verifyMuxSignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) {
    console.error('Missing Mux signature header');
    return false;
  }

  // Parse the signature header (format: t=timestamp,v1=signature)
  const parts: Record<string, string> = {};
  signature.split(',').forEach(part => {
    const [key, value] = part.split('=');
    if (key && value) parts[key] = value;
  });

  const timestamp = parts['t'];
  const providedSig = parts['v1'];

  if (!timestamp || !providedSig) {
    console.error('Invalid signature format');
    return false;
  }

  // Check timestamp to prevent replay attacks (5 minute window)
  const webhookTime = parseInt(timestamp);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - webhookTime) > 300) {
    console.error('Webhook timestamp expired:', { webhookTime, currentTime });
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const payload = `${timestamp}.${rawBody}`;
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSig = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (expectedSig !== providedSig) {
      console.error('Signature mismatch');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Send transcoding notification
async function sendTranscodingNotification(
  supabaseUrl: string,
  serviceKey: string,
  jobId: string,
  status: "completed" | "failed",
  episodeTitle?: string,
  showTitle?: string,
  errorMessage?: string
) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/transcoding-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ jobId, status, episodeTitle, showTitle, errorMessage }),
    });
    console.log("Notification sent:", await response.json());
  } catch (err) {
    console.error("Failed to send notification:", err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const muxWebhookSecret = Deno.env.get('MUX_WEBHOOK_SECRET');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body for signature verification
    const rawBody = await req.text();
    const muxSignature = req.headers.get('mux-signature');

    // Verify webhook signature if secret is configured
    if (muxWebhookSecret) {
      const isValid = await verifyMuxSignature(rawBody, muxSignature, muxWebhookSecret);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('Mux signature verified successfully');
    } else {
      console.warn('MUX_WEBHOOK_SECRET not configured - skipping signature verification');
    }

    const payload = JSON.parse(rawBody);
    const { type, data } = payload;
    console.log('Mux webhook received:', type);

    switch (type) {
      case 'video.asset.ready': {
        const passthrough = JSON.parse(data.passthrough || '{}');
        const { episodeId, jobId, contentId } = passthrough;
        
        if (!episodeId) {
          console.log('No episodeId in passthrough, skipping');
          break;
        }

        const playbackId = data.playback_ids?.[0]?.id;
        if (!playbackId) {
          console.error('No playback ID found');
          break;
        }

        const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
        const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;

        // Get episode and show info
        const { data: episodeData } = await supabase
          .from('episodes')
          .select('title, season_id')
          .eq('id', episodeId)
          .single();

        let showTitle = '';
        let resolvedContentId = contentId;
        
        if (episodeData?.season_id) {
          const { data: seasonData } = await supabase
            .from('seasons')
            .select('content_id')
            .eq('id', episodeData.season_id)
            .single();
          
          if (seasonData?.content_id) {
            resolvedContentId = seasonData.content_id;
            const { data: contentData } = await supabase
              .from('content')
              .select('title')
              .eq('id', seasonData.content_id)
              .single();
            showTitle = contentData?.title || '';
          }
        }

        // Update episode
        await supabase
          .from('episodes')
          .update({ video_url: hlsUrl, thumbnail_url: thumbnailUrl })
          .eq('id', episodeId);

        // Update transcoding job
        if (jobId) {
          await supabase
            .from('transcoding_jobs')
            .update({ 
              status: 'completed',
              progress: 100,
              output_url: hlsUrl,
              completed_at: new Date().toISOString(),
            })
            .eq('id', jobId);

          await sendTranscodingNotification(supabaseUrl, supabaseServiceKey, jobId, "completed", episodeData?.title, showTitle);
        }
        console.log(`Episode ${episodeId} updated with HLS URL`);

        // Trigger automatic subtitle generation in background (fire and forget)
        if (resolvedContentId && hlsUrl) {
          console.log('Triggering automatic subtitle generation...');
          // Use setTimeout to make this non-blocking
          setTimeout(async () => {
            try {
              const res = await fetch(`${supabaseUrl}/functions/v1/generate-subtitles-auto`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  videoUrl: hlsUrl,
                  contentId: resolvedContentId,
                  episodeId,
                  title: episodeData?.title || showTitle || 'Untitled Episode'
                })
              });
              if (res.ok) {
                console.log('Subtitle generation triggered successfully');
              } else {
                console.error('Subtitle generation trigger failed:', res.status);
              }
            } catch (err) {
              console.error('Failed to trigger subtitle generation:', err);
            }
          }, 100);
        }
        break;
      }

      case 'video.asset.errored': {
        const passthrough = JSON.parse(data.passthrough || '{}');
        const { jobId, episodeId } = passthrough;

        let episodeTitle = '';
        let showTitle = '';
        
        if (episodeId) {
          const { data: episodeData } = await supabase
            .from('episodes')
            .select('title, season_id')
            .eq('id', episodeId)
            .single();
          
          episodeTitle = episodeData?.title || '';
          if (episodeData?.season_id) {
            const { data: seasonData } = await supabase.from('seasons').select('content_id').eq('id', episodeData.season_id).single();
            if (seasonData?.content_id) {
              const { data: contentData } = await supabase.from('content').select('title').eq('id', seasonData.content_id).single();
              showTitle = contentData?.title || '';
            }
          }
        }

        if (jobId) {
          const errorMessage = data.errors?.messages?.join(', ') || 'Transcoding failed';
          await supabase
            .from('transcoding_jobs')
            .update({ status: 'failed', error_message: errorMessage, completed_at: new Date().toISOString() })
            .eq('id', jobId);

          await sendTranscodingNotification(supabaseUrl, supabaseServiceKey, jobId, "failed", episodeTitle, showTitle, errorMessage);
        }
        break;
      }

      case 'video.asset.created': {
        const passthrough = JSON.parse(data.passthrough || '{}');
        const { jobId } = passthrough;
        if (jobId) {
          await supabase.from('transcoding_jobs').update({ status: 'processing', progress: 10 }).eq('id', jobId);
        }
        break;
      }

      case 'video.upload.asset_created': {
        const passthrough = JSON.parse(data.passthrough || '{}');
        const { jobId } = passthrough;
        if (jobId) {
          await supabase.from('transcoding_jobs').update({ status: 'processing', progress: 50 }).eq('id', jobId);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});