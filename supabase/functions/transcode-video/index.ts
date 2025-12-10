import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, episodeId, sourceUrl, format = 'hls' } = await req.json();

    if (action === 'queue') {
      // Queue a new transcoding job
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

      console.log(`Transcoding job queued: ${job.id} for episode ${episodeId}`);

      // NOTE: In production, you would trigger an external transcoding service here
      // Options include:
      // 1. AWS MediaConvert - trigger via AWS SDK
      // 2. Mux Video - upload to Mux API
      // 3. Cloudflare Stream - upload to Stream API
      // 4. Self-hosted FFmpeg worker - send to your worker service
      
      // For now, we just queue the job and return
      // The actual transcoding would be handled by a separate worker

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
      // Get status of a transcoding job
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
      // Handle webhook from external transcoding service
      const { jobId, status, outputUrl, progress, error: transcodeError } = await req.json();

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
