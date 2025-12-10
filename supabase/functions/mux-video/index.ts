import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MUX_BASE_URL = 'https://api.mux.com';

// Verify admin authentication
async function verifyAdminAuth(req: Request, supabase: any): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return { user: null, error: 'Missing authorization header' };

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { user: null, error: 'Invalid token' };

  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) return { user: null, error: 'Forbidden - admin access required' };

  return { user };
}

async function muxRequest(method: string, path: string, body?: any) {
  const tokenId = Deno.env.get('MUX_TOKEN_ID');
  const tokenSecret = Deno.env.get('MUX_TOKEN_SECRET');
  
  if (!tokenId || !tokenSecret) throw new Error('Mux credentials not configured');

  const auth = btoa(`${tokenId}:${tokenSecret}`);
  const response = await fetch(`${MUX_BASE_URL}${path}`, {
    method,
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.messages?.[0] || 'Mux API request failed');
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

    // All actions require admin authentication
    const { user, error: authError } = await verifyAdminAuth(req, supabase);
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), { 
        status: authError.includes('Forbidden') ? 403 : 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`Mux action: ${action} by admin ${user.id}`);

    switch (action) {
      case 'upload': {
        const { episodeId, jobId } = params;
        if (!episodeId) throw new Error('episodeId is required');

        const uploadData = await muxRequest('POST', '/video/v1/uploads', {
          new_asset_settings: {
            playback_policy: ['public'],
            passthrough: JSON.stringify({ episodeId, jobId }),
          },
          cors_origin: '*',
        });

        return new Response(JSON.stringify({ uploadId: uploadData.data.id, uploadUrl: uploadData.data.url }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      case 'ingest': {
        const { sourceUrl, episodeId, jobId } = params;
        if (!sourceUrl || !episodeId) throw new Error('sourceUrl and episodeId are required');

        const assetData = await muxRequest('POST', '/video/v1/assets', {
          input: sourceUrl,
          playback_policy: ['public'],
          passthrough: JSON.stringify({ episodeId, jobId }),
        });

        if (jobId) {
          await supabase.from('transcoding_jobs').update({ status: 'processing', progress: 10 }).eq('id', jobId);
        }

        return new Response(JSON.stringify({ assetId: assetData.data.id, status: assetData.data.status }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      case 'status': {
        const { assetId } = params;
        if (!assetId) throw new Error('assetId is required');

        const assetData = await muxRequest('GET', `/video/v1/assets/${assetId}`);
        const asset = assetData.data;

        const response: any = { status: asset.status, duration: asset.duration, aspectRatio: asset.aspect_ratio };
        if (asset.status === 'ready' && asset.playback_ids?.length > 0) {
          const playbackId = asset.playback_ids[0].id;
          response.playbackId = playbackId;
          response.hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
          response.thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
        }

        return new Response(JSON.stringify(response), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      case 'thumbnail': {
        const { playbackId, time = 0, width = 640 } = params;
        if (!playbackId) throw new Error('playbackId is required');

        return new Response(JSON.stringify({ 
          thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=${width}` 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (err) {
    console.error('Mux error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});