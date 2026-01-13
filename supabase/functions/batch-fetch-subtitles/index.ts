import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchRequest {
  action: 'start' | 'pause' | 'resume' | 'status' | 'process-next';
  jobId?: string;
  contentTypes?: string[];
  languages?: string[];
  batchSize?: number;
}

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  tmdb_id: number | null;
}

interface EpisodeItem {
  id: string;
  title: string;
  episode_number: number;
  season_number: number;
  content_id: string;
  content_title: string;
  tmdb_id: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: BatchRequest = await req.json();
    const { action, jobId, contentTypes = ['movie', 'series'], languages = ['en', 'fr'], batchSize = 1 } = body;

    console.log(`[BatchFetch] Action: ${action}, JobId: ${jobId || 'new'}`);

    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (action === 'start') {
      // Count total items to process
      let totalMovies = 0;
      let totalEpisodes = 0;

      if (contentTypes.includes('movie')) {
        const { count } = await supabase
          .from('content')
          .select('id', { count: 'exact', head: true })
          .eq('content_type', 'movie');
        totalMovies = count || 0;
      }

      if (contentTypes.includes('series')) {
        const { count } = await supabase
          .from('episodes')
          .select('id', { count: 'exact', head: true });
        totalEpisodes = count || 0;
      }

      const totalItems = totalMovies + totalEpisodes;

      // Create new sync job
      const { data: job, error: jobError } = await supabase
        .from('subtitle_sync_jobs')
        .insert({
          status: 'running',
          total_items: totalItems,
          content_types: contentTypes,
          languages: languages,
          started_at: new Date().toISOString(),
          created_by: userId,
        })
        .select()
        .single();

      if (jobError) {
        console.error('[BatchFetch] Error creating job:', jobError);
        throw jobError;
      }

      console.log(`[BatchFetch] Created job ${job.id} with ${totalItems} items`);

      return new Response(JSON.stringify({
        success: true,
        job: job,
        message: `Started sync job for ${totalItems} items`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      if (!jobId) {
        // Get most recent job
        const { data: jobs } = await supabase
          .from('subtitle_sync_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);

        return new Response(JSON.stringify({
          success: true,
          job: jobs?.[0] || null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: job } = await supabase
        .from('subtitle_sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      return new Response(JSON.stringify({
        success: true,
        job: job,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'pause') {
      if (!jobId) throw new Error('jobId required for pause');

      await supabase
        .from('subtitle_sync_jobs')
        .update({ status: 'paused' })
        .eq('id', jobId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Job paused',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'resume') {
      if (!jobId) throw new Error('jobId required for resume');

      await supabase
        .from('subtitle_sync_jobs')
        .update({ status: 'running' })
        .eq('id', jobId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Job resumed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'process-next') {
      if (!jobId) throw new Error('jobId required for process-next');

      // Get job details
      const { data: job, error: jobFetchError } = await supabase
        .from('subtitle_sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobFetchError || !job) {
        throw new Error('Job not found');
      }

      if (job.status !== 'running') {
        return new Response(JSON.stringify({
          success: false,
          message: `Job is ${job.status}, not running`,
          job: job,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const processedResults: any[] = [];
      let itemsProcessed = 0;
      let itemsSuccessful = 0;
      let itemsFailed = 0;
      let itemsSkipped = 0;

      // Process movies first, then episodes
      for (let i = 0; i < batchSize; i++) {
        // Try to find next movie to process
        let contentToProcess: ContentItem | null = null;
        let episodeToProcess: EpisodeItem | null = null;

        if (job.content_types.includes('movie')) {
          // Get movies that don't have subtitles for all requested languages
          const { data: movies } = await supabase
            .from('content')
            .select('id, title, content_type, tmdb_id')
            .eq('content_type', 'movie')
            .order('created_at', { ascending: true })
            .limit(100);

          if (movies && movies.length > 0) {
            // Find one without complete subtitles
            for (const movie of movies) {
              const { data: existingSubs } = await supabase
                .from('subtitles')
                .select('language_code')
                .eq('content_id', movie.id)
                .is('episode_id', null);

              const existingLangs = existingSubs?.map(s => s.language_code) || [];
              const missingLangs = job.languages.filter((l: string) => !existingLangs.includes(l));

              if (missingLangs.length > 0) {
                contentToProcess = movie as ContentItem;
                break;
              }
            }
          }
        }

        if (!contentToProcess && job.content_types.includes('series')) {
          // Get episodes that don't have subtitles
          const { data: episodes } = await supabase
            .from('episodes')
            .select(`
              id, 
              title, 
              episode_number,
              season:seasons!inner(
                season_number,
                content:content!inner(id, title, tmdb_id)
              )
            `)
            .order('created_at', { ascending: true })
            .limit(100);

          if (episodes && episodes.length > 0) {
            for (const ep of episodes) {
              const { data: existingSubs } = await supabase
                .from('subtitles')
                .select('language_code')
                .eq('episode_id', ep.id);

              const existingLangs = existingSubs?.map(s => s.language_code) || [];
              const missingLangs = job.languages.filter((l: string) => !existingLangs.includes(l));

              if (missingLangs.length > 0) {
                const season = ep.season as any;
                episodeToProcess = {
                  id: ep.id,
                  title: ep.title,
                  episode_number: ep.episode_number,
                  season_number: season.season_number,
                  content_id: season.content.id,
                  content_title: season.content.title,
                  tmdb_id: season.content.tmdb_id,
                };
                break;
              }
            }
          }
        }

        if (!contentToProcess && !episodeToProcess) {
          // No more items to process
          await supabase
            .from('subtitle_sync_jobs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', jobId);

          return new Response(JSON.stringify({
            success: true,
            message: 'All items processed',
            completed: true,
            job: { ...job, status: 'completed' },
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Process the item
        try {
          const fetchPayload = contentToProcess
            ? {
                contentId: contentToProcess.id,
                languages: job.languages,
              }
            : {
                contentId: episodeToProcess!.content_id,
                episodeId: episodeToProcess!.id,
                languages: job.languages,
              };

          console.log(`[BatchFetch] Processing: ${contentToProcess?.title || episodeToProcess?.content_title} - ${episodeToProcess ? `S${episodeToProcess.season_number}E${episodeToProcess.episode_number}` : 'Movie'}`);

          // Call auto-fetch-subtitles function
          const fetchResponse = await fetch(`${supabaseUrl}/functions/v1/auto-fetch-subtitles`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify(fetchPayload),
          });

          const fetchResult = await fetchResponse.json();

          itemsProcessed++;

          if (fetchResult.success) {
            const fetchedCount = fetchResult.results?.fetched?.length || 0;
            const skippedCount = fetchResult.results?.skipped?.length || 0;
            const failedCount = fetchResult.results?.failed?.length || 0;

            if (fetchedCount > 0) {
              itemsSuccessful++;
            } else if (skippedCount > 0) {
              itemsSkipped++;
            } else {
              itemsFailed++;
            }

            processedResults.push({
              item: contentToProcess?.title || `${episodeToProcess?.content_title} S${episodeToProcess?.season_number}E${episodeToProcess?.episode_number}`,
              result: fetchResult.results,
            });
          } else {
            itemsFailed++;
            processedResults.push({
              item: contentToProcess?.title || `${episodeToProcess?.content_title} S${episodeToProcess?.season_number}E${episodeToProcess?.episode_number}`,
              error: fetchResult.error || 'Unknown error',
            });
          }
        } catch (fetchError) {
          console.error('[BatchFetch] Error fetching subtitles:', fetchError);
          itemsFailed++;
          itemsProcessed++;
        }

        // Update job progress
        await supabase
          .from('subtitle_sync_jobs')
          .update({
            processed_items: job.processed_items + itemsProcessed,
            successful_items: job.successful_items + itemsSuccessful,
            failed_items: job.failed_items + itemsFailed,
            skipped_items: job.skipped_items + itemsSkipped,
            current_content_id: contentToProcess?.id || episodeToProcess?.content_id || null,
            current_episode_id: episodeToProcess?.id || null,
          })
          .eq('id', jobId);
      }

      // Get updated job
      const { data: updatedJob } = await supabase
        .from('subtitle_sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      return new Response(JSON.stringify({
        success: true,
        results: processedResults,
        job: updatedJob,
        completed: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error('[BatchFetch] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
