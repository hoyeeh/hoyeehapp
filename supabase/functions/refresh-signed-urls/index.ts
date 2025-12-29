import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ONE_YEAR_SECONDS = 31536000;

// Extract storage path from a signed URL
function extractStoragePath(signedUrl: string): string | null {
  try {
    const url = new URL(signedUrl);
    // Pattern: /storage/v1/object/sign/bucket-name/path/to/file
    const match = url.pathname.match(/\/storage\/v1\/object\/sign\/([^?]+)/);
    if (match) {
      // Remove the bucket name from the path
      const fullPath = match[1];
      const parts = fullPath.split('/');
      parts.shift(); // Remove bucket name
      return parts.join('/');
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contentId } = await req.json().catch(() => ({}));

    console.log('Refreshing signed URLs...', contentId ? `for content ${contentId}` : 'for all creator content');

    // Build query for creator content submissions with signed URLs
    let query = supabase
      .from('creator_content_submissions')
      .select('id, video_url, cover_image_url, poster_image_url, creator_profiles(user_id)');
    
    if (contentId) {
      query = query.eq('id', contentId);
    }

    const { data: submissions, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch submissions: ${fetchError.message}`);
    }

    console.log(`Found ${submissions?.length || 0} submissions to process`);

    const results: { id: string; updated: boolean; error?: string }[] = [];

    for (const submission of submissions || []) {
      try {
        const updates: Record<string, string> = {};
        const creatorUserId = (submission.creator_profiles as any)?.user_id;

        // Process video_url
        if (submission.video_url && submission.video_url.includes('token=')) {
          const path = extractStoragePath(submission.video_url);
          if (path) {
            const { data, error } = await supabase.storage
              .from('creator-uploads')
              .createSignedUrl(path, ONE_YEAR_SECONDS);
            
            if (!error && data?.signedUrl) {
              updates.video_url = data.signedUrl;
              console.log(`Refreshed video_url for submission ${submission.id}`);
            }
          }
        }

        // Process cover_image_url
        if (submission.cover_image_url && submission.cover_image_url.includes('token=')) {
          const path = extractStoragePath(submission.cover_image_url);
          if (path) {
            const { data, error } = await supabase.storage
              .from('creator-uploads')
              .createSignedUrl(path, ONE_YEAR_SECONDS);
            
            if (!error && data?.signedUrl) {
              updates.cover_image_url = data.signedUrl;
              console.log(`Refreshed cover_image_url for submission ${submission.id}`);
            }
          }
        }

        // Process poster_image_url
        if (submission.poster_image_url && submission.poster_image_url.includes('token=')) {
          const path = extractStoragePath(submission.poster_image_url);
          if (path) {
            const { data, error } = await supabase.storage
              .from('creator-uploads')
              .createSignedUrl(path, ONE_YEAR_SECONDS);
            
            if (!error && data?.signedUrl) {
              updates.poster_image_url = data.signedUrl;
              console.log(`Refreshed poster_image_url for submission ${submission.id}`);
            }
          }
        }

        // Update database if there are changes
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('creator_content_submissions')
            .update(updates)
            .eq('id', submission.id);

          if (updateError) {
            results.push({ id: submission.id, updated: false, error: updateError.message });
          } else {
            results.push({ id: submission.id, updated: true });
          }
        } else {
          results.push({ id: submission.id, updated: false });
        }
      } catch (err) {
        results.push({ id: submission.id, updated: false, error: String(err) });
      }
    }

    // Also update content table for approved creator content
    const { data: contentItems } = await supabase
      .from('content')
      .select('id, video_url, thumbnail_url, created_by')
      .not('created_by', 'is', null);

    for (const content of contentItems || []) {
      try {
        const updates: Record<string, string> = {};

        if (content.video_url && content.video_url.includes('token=')) {
          const path = extractStoragePath(content.video_url);
          if (path) {
            const { data, error } = await supabase.storage
              .from('creator-uploads')
              .createSignedUrl(path, ONE_YEAR_SECONDS);
            
            if (!error && data?.signedUrl) {
              updates.video_url = data.signedUrl;
            }
          }
        }

        if (content.thumbnail_url && content.thumbnail_url.includes('token=')) {
          const path = extractStoragePath(content.thumbnail_url);
          if (path) {
            const { data, error } = await supabase.storage
              .from('creator-uploads')
              .createSignedUrl(path, ONE_YEAR_SECONDS);
            
            if (!error && data?.signedUrl) {
              updates.thumbnail_url = data.signedUrl;
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('content')
            .update(updates)
            .eq('id', content.id);
          
          console.log(`Refreshed URLs for content ${content.id}`);
        }
      } catch (err) {
        console.error(`Error refreshing content ${content.id}:`, err);
      }
    }

    const updatedCount = results.filter(r => r.updated).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Refreshed ${updatedCount} submission(s)`,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    console.error('Error refreshing signed URLs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
