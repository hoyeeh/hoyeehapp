import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to verify admin authentication
async function verifyAdminAuth(req: Request, supabase: any): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { user: null, error: 'Missing authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return { user: null, error: 'Invalid token' };
  }

  // Verify admin role
  const { data: isAdmin } = await supabase.rpc('has_role', { 
    _user_id: user.id, 
    _role: 'admin' 
  });

  if (!isAdmin) {
    return { user: null, error: 'Forbidden - admin access required' };
  }

  return { user };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, episodeId, sourceUrl, format = 'hls', jobId, status, outputUrl, progress, error: transcodeError } = body;

    // Actions that require admin authentication
    if (action === 'queue') {
      const { user, error: authError } = await verifyAdminAuth(req, supabase);
      if (authError) {
        console.error('Auth error:', authError);
        return new Response(
          JSON.stringify({ error: authError }),
          { status: authError === 'Forbidden - admin access required' ? 403 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!episodeId || !sourceUrl) {
        return new Response(
          JSON.stringify({ error: 'episodeId and sourceUrl are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if there's already a pending/processing job for this episode
      const { data: existingJob } = await supabase
        .from('transcoding_jobs')
        .select('id, status')
        .eq('episode_id', episodeId)
        .in('status', ['pending', 'processing'])
        .single();

      if (existingJob) {
        return new Response(
          JSON.stringify({ 
            error: 'A transcoding job is already in progress for this episode',
            jobId: existingJob.id 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create new transcoding job
      const { data: job, error: insertError } = await supabase
        .from('transcoding_jobs')
        .insert({
          episode_id: episodeId,
          source_url: sourceUrl,
          format,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`Transcoding job queued by admin ${user.id}: ${job.id} for episode ${episodeId}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          job,
          message: 'Transcoding job queued. Note: Actual transcoding requires an external service (AWS MediaConvert, Mux, etc.)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'status') {
      // Status check requires admin auth
      const { error: authError } = await verifyAdminAuth(req, supabase);
      if (authError) {
        return new Response(
          JSON.stringify({ error: authError }),
          { status: authError === 'Forbidden - admin access required' ? 403 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: jobs, error } = await supabase
        .from('transcoding_jobs')
        .select('*')
        .eq('episode_id', episodeId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      return new Response(
        JSON.stringify({ job: jobs?.[0] || null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'webhook') {
      // Webhook action - verify with shared secret
      const webhookSecret = Deno.env.get('TRANSCODING_WEBHOOK_SECRET');
      const providedSecret = req.headers.get('x-webhook-secret');
      
      if (webhookSecret && providedSecret !== webhookSecret) {
        console.error('Invalid webhook secret');
        return new Response(
          JSON.stringify({ error: 'Invalid webhook secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const updateData: any = { 
        status,
        progress: progress || 0,
      };

      if (outputUrl) {
        updateData.output_url = outputUrl;
      }

      if (transcodeError) {
        updateData.error_message = transcodeError;
      }

      if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('transcoding_jobs')
        .update(updateData)
        .eq('id', jobId);

      if (updateError) throw updateError;

      // If completed successfully, update the episode with the HLS URL
      if (status === 'completed' && outputUrl) {
        const { data: job } = await supabase
          .from('transcoding_jobs')
          .select('episode_id')
          .eq('id', jobId)
          .single();

        if (job) {
          await supabase
            .from('episodes')
            .update({ video_url: outputUrl })
            .eq('id', job.episode_id);
        }
      }

      console.log(`Webhook processed for job ${jobId}: status=${status}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: queue, status, or webhook' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Transcoding error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
