import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, mux-signature',
};

// Helper function to send transcoding notification
async function sendTranscodingNotification(
  supabaseUrl: string,
  anonKey: string,
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
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ jobId, status, episodeTitle, showTitle, errorMessage }),
    });
    const result = await response.json();
    console.log("Notification sent:", result);
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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const { type, data } = payload;
    
    console.log('Mux webhook received:', type, JSON.stringify(data, null, 2));

    // Handle different Mux webhook events
    switch (type) {
      case 'video.asset.ready': {
        const passthrough = JSON.parse(data.passthrough || '{}');
        const { episodeId, jobId } = passthrough;
        
        if (!episodeId) {
          console.log('No episodeId in passthrough, skipping');
          break;
        }

        const playbackId = data.playback_ids?.[0]?.id;
        if (!playbackId) {
          console.error('No playback ID found in asset');
          break;
        }

        const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
        const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;

        // Get episode and show info for notification
        const { data: episodeData } = await supabase
          .from('episodes')
          .select('title, season_id')
          .eq('id', episodeId)
          .single();

        let showTitle = '';
        if (episodeData?.season_id) {
          const { data: seasonData } = await supabase
            .from('seasons')
            .select('content_id')
            .eq('id', episodeData.season_id)
            .single();
          
          if (seasonData?.content_id) {
            const { data: contentData } = await supabase
              .from('content')
              .select('title')
              .eq('id', seasonData.content_id)
              .single();
            showTitle = contentData?.title || '';
          }
        }

        // Update episode with HLS URL and thumbnail
        const { error: episodeError } = await supabase
          .from('episodes')
          .update({ 
            video_url: hlsUrl,
            thumbnail_url: thumbnailUrl,
          })
          .eq('id', episodeId);

        if (episodeError) {
          console.error('Error updating episode:', episodeError);
        } else {
          console.log(`Episode ${episodeId} updated with HLS URL: ${hlsUrl}`);
        }

        // Update transcoding job
        if (jobId) {
          const { error: jobError } = await supabase
            .from('transcoding_jobs')
            .update({ 
              status: 'completed',
              progress: 100,
              output_url: hlsUrl,
              completed_at: new Date().toISOString(),
            })
            .eq('id', jobId);

          if (jobError) {
            console.error('Error updating transcoding job:', jobError);
          } else {
            console.log(`Transcoding job ${jobId} marked as completed`);
            
            // Send notification email
            await sendTranscodingNotification(
              supabaseUrl, 
              anonKey, 
              jobId, 
              "completed", 
              episodeData?.title,
              showTitle
            );
          }
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
            const { data: seasonData } = await supabase
              .from('seasons')
              .select('content_id')
              .eq('id', episodeData.season_id)
              .single();
            
            if (seasonData?.content_id) {
              const { data: contentData } = await supabase
                .from('content')
                .select('title')
                .eq('id', seasonData.content_id)
                .single();
              showTitle = contentData?.title || '';
            }
          }
        }

        if (jobId) {
          const errorMessage = data.errors?.messages?.join(', ') || 'Transcoding failed';
          
          await supabase
            .from('transcoding_jobs')
            .update({ 
              status: 'failed',
              error_message: errorMessage,
              completed_at: new Date().toISOString(),
            })
            .eq('id', jobId);

          console.log(`Transcoding job ${jobId} failed: ${errorMessage}`);
          
          // Send failure notification email
          await sendTranscodingNotification(
            supabaseUrl, 
            anonKey, 
            jobId, 
            "failed", 
            episodeTitle,
            showTitle,
            errorMessage
          );
        }
        break;
      }

      case 'video.asset.created': {
        const passthrough = JSON.parse(data.passthrough || '{}');
        const { jobId } = passthrough;

        if (jobId) {
          await supabase
            .from('transcoding_jobs')
            .update({ 
              status: 'processing',
              progress: 10,
            })
            .eq('id', jobId);

          console.log(`Transcoding job ${jobId} started processing`);
        }
        break;
      }

      case 'video.asset.live_stream_completed':
      case 'video.upload.asset_created': {
        // Asset was created from upload
        const passthrough = JSON.parse(data.passthrough || '{}');
        const { jobId } = passthrough;

        if (jobId) {
          await supabase
            .from('transcoding_jobs')
            .update({ 
              status: 'processing',
              progress: 50,
            })
            .eq('id', jobId);

          console.log(`Transcoding job ${jobId} upload complete, processing`);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Webhook error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
