import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify admin authentication
async function verifyAdminAuth(req: Request, supabaseAdmin: any): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return { user: null, error: 'Missing authorization header' };

  const token = authHeader.replace('Bearer ', '');
  
  // Use a client with the anon key for user token verification
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  
  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) return { user: null, error: 'Invalid token' };

  // Use admin client to check role
  const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) return { user: null, error: 'Forbidden - admin access required' };

  return { user };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, episodeId, sourceUrl, format = 'hls', jobId, status, outputUrl, progress, error: transcodeError } = body;

    // Queue action - requires admin auth
    if (action === 'queue') {
      const { user, error: authError } = await verifyAdminAuth(req, supabase);
      if (authError) {
        return new Response(JSON.stringify({ error: authError }), { 
          status: authError.includes('Forbidden') ? 403 : 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      if (!episodeId || !sourceUrl) {
        return new Response(JSON.stringify({ error: 'episodeId and sourceUrl are required' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { data: existingJob } = await supabase
        .from('transcoding_jobs')
        .select('id, status')
        .eq('episode_id', episodeId)
        .in('status', ['pending', 'processing'])
        .single();

      if (existingJob) {
        return new Response(JSON.stringify({ error: 'A transcoding job is already in progress', jobId: existingJob.id }), { 
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { data: job, error: insertError } = await supabase
        .from('transcoding_jobs')
        .insert({ episode_id: episodeId, source_url: sourceUrl, format, status: 'pending' })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`Transcoding job queued by admin ${user.id}: ${job.id}`);
      return new Response(JSON.stringify({ success: true, job, message: 'Transcoding job queued' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Status check - requires admin auth
    if (action === 'status') {
      const { error: authError } = await verifyAdminAuth(req, supabase);
      if (authError) {
        return new Response(JSON.stringify({ error: authError }), { 
          status: authError.includes('Forbidden') ? 403 : 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { data: jobs, error } = await supabase
        .from('transcoding_jobs')
        .select('*')
        .eq('episode_id', episodeId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return new Response(JSON.stringify({ job: jobs?.[0] || null }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Webhook action - verify with shared secret
    if (action === 'webhook') {
      const webhookSecret = Deno.env.get('TRANSCODING_WEBHOOK_SECRET');
      const providedSecret = req.headers.get('x-webhook-secret');
      
      if (webhookSecret && providedSecret !== webhookSecret) {
        return new Response(JSON.stringify({ error: 'Invalid webhook secret' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const updateData: any = { status, progress: progress || 0 };
      if (outputUrl) updateData.output_url = outputUrl;
      if (transcodeError) updateData.error_message = transcodeError;
      if (status === 'completed' || status === 'failed') updateData.completed_at = new Date().toISOString();

      await supabase.from('transcoding_jobs').update(updateData).eq('id', jobId);

      if (status === 'completed' && outputUrl) {
        const { data: job } = await supabase.from('transcoding_jobs').select('episode_id').eq('id', jobId).single();
        if (job) await supabase.from('episodes').update({ video_url: outputUrl }).eq('id', job.episode_id);
      }

      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    console.error('Transcoding error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});