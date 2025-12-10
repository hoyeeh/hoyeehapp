import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MUX_BASE_URL = 'https://api.mux.com';

async function muxRequest(method: string, path: string, body?: any) {
  const tokenId = Deno.env.get('MUX_TOKEN_ID');
  const tokenSecret = Deno.env.get('MUX_TOKEN_SECRET');
  
  if (!tokenId || !tokenSecret) {
    throw new Error('Mux credentials not configured');
  }

  const auth = btoa(`${tokenId}:${tokenSecret}`);
  
  const response = await fetch(`${MUX_BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Mux API error:', data);
    throw new Error(data.error?.messages?.[0] || 'Mux API request failed');
  }

  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();
    console.log(`Mux action: ${action}`, params);

    switch (action) {
      case 'upload': {
        // Create a direct upload URL for the client
        const { episodeId, jobId } = params;
        
        if (!episodeId) {
          throw new Error('episodeId is required');
        }

        // Create Mux upload with passthrough metadata
        const uploadData = await muxRequest('POST', '/video/v1/uploads', {
          new_asset_settings: {
            playback_policy: ['public'],
            passthrough: JSON.stringify({ episodeId, jobId }),
          },
          cors_origin: '*',
        });

        console.log('Mux upload created:', uploadData.data.id);

        return new Response(
          JSON.stringify({ 
            uploadId: uploadData.data.id,
            uploadUrl: uploadData.data.url,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'ingest': {
        // Ingest from an existing URL (like DO Spaces)
        const { sourceUrl, episodeId, jobId } = params;
        
        if (!sourceUrl || !episodeId) {
          throw new Error('sourceUrl and episodeId are required');
        }

        // Create asset from URL
        const assetData = await muxRequest('POST', '/video/v1/assets', {
          input: sourceUrl,
          playback_policy: ['public'],
          passthrough: JSON.stringify({ episodeId, jobId }),
        });

        const asset = assetData.data;
        console.log('Mux asset created:', asset.id);

        // Update transcoding job with Mux asset ID
        if (jobId) {
          await supabase
            .from('transcoding_jobs')
            .update({ 
              status: 'processing',
              progress: 10,
            })
            .eq('id', jobId);
        }

        return new Response(
          JSON.stringify({ 
            assetId: asset.id,
            status: asset.status,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'status': {
        // Check asset status
        const { assetId } = params;
        
        if (!assetId) {
          throw new Error('assetId is required');
        }

        const assetData = await muxRequest('GET', `/video/v1/assets/${assetId}`);
        const asset = assetData.data;

        // Build response with playback URLs if ready
        const response: any = {
          status: asset.status,
          duration: asset.duration,
          aspectRatio: asset.aspect_ratio,
        };

        if (asset.status === 'ready' && asset.playback_ids?.length > 0) {
          const playbackId = asset.playback_ids[0].id;
          response.playbackId = playbackId;
          response.hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
          response.thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
          response.animatedGifUrl = `https://image.mux.com/${playbackId}/animated.gif`;
        }

        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'webhook': {
        // Handle Mux webhooks
        const { type, data } = params;
        console.log('Mux webhook:', type, data);

        if (type === 'video.asset.ready') {
          const passthrough = JSON.parse(data.passthrough || '{}');
          const { episodeId, jobId } = passthrough;
          
          if (!episodeId) {
            console.log('No episodeId in passthrough, skipping');
            return new Response(JSON.stringify({ received: true }), { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }

          const playbackId = data.playback_ids?.[0]?.id;
          const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
          const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;

          // Update episode with HLS URL and thumbnail
          await supabase
            .from('episodes')
            .update({ 
              video_url: hlsUrl,
              thumbnail_url: thumbnailUrl,
            })
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
          }

          console.log(`Episode ${episodeId} updated with HLS URL and thumbnail`);
        }

        if (type === 'video.asset.errored') {
          const passthrough = JSON.parse(data.passthrough || '{}');
          const { jobId } = passthrough;

          if (jobId) {
            await supabase
              .from('transcoding_jobs')
              .update({ 
                status: 'failed',
                error_message: data.errors?.messages?.join(', ') || 'Transcoding failed',
                completed_at: new Date().toISOString(),
              })
              .eq('id', jobId);
          }
        }

        return new Response(JSON.stringify({ received: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      case 'thumbnail': {
        // Generate thumbnail from existing Mux asset
        const { playbackId, time = 0, width = 640 } = params;
        
        if (!playbackId) {
          throw new Error('playbackId is required');
        }

        const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=${width}`;
        
        return new Response(
          JSON.stringify({ thumbnailUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (err) {
    console.error('Mux error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
