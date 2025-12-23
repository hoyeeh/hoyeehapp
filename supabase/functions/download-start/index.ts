import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DownloadRequest {
  contentId: string;
  episodeId?: string;
  deviceId: string;
  preferredQuality?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body: DownloadRequest = await req.json();
    const { contentId, episodeId, deviceId, preferredQuality = '720p' } = body;

    if (!contentId || !deviceId) {
      return new Response(
        JSON.stringify({ error: 'contentId and deviceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[download-start] User ${user.id} requesting download for content ${contentId}, episode ${episodeId || 'N/A'}`);

    // Check user subscription
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_subscribed, subscription_expiry')
      .eq('id', user.id)
      .single();

    const isSubscribed = profile?.is_subscribed && 
      (!profile.subscription_expiry || new Date(profile.subscription_expiry) > new Date());

    if (!isSubscribed) {
      return new Response(
        JSON.stringify({ error: 'Active subscription required for downloads', code: 'NO_SUBSCRIPTION' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get content details
    let videoUrl: string | null = null;
    let title: string = '';
    let thumbnailUrl: string | null = null;
    let duration: number = 0;
    let episodeTitle: string | undefined;
    let contentRating: string | null = null;

    if (episodeId) {
      // Get episode details
      const { data: episode, error: episodeError } = await supabase
        .from('episodes')
        .select(`
          id, title, video_url, thumbnail_url, duration,
          season:seasons!inner(
            content:content!inner(id, title, thumbnail_url, content_rating)
          )
        `)
        .eq('id', episodeId)
        .single();

      if (episodeError || !episode) {
        return new Response(
          JSON.stringify({ error: 'Episode not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      videoUrl = episode.video_url;
      episodeTitle = episode.title;
      title = (episode.season as any)?.content?.title || episode.title;
      thumbnailUrl = episode.thumbnail_url || (episode.season as any)?.content?.thumbnail_url;
      duration = episode.duration || 0;
      contentRating = (episode.season as any)?.content?.content_rating || null;
    } else {
      // Get movie details
      const { data: content, error: contentError } = await supabase
        .from('content')
        .select('id, title, video_url, thumbnail_url, duration, content_rating')
        .eq('id', contentId)
        .single();

      if (contentError || !content) {
        return new Response(
          JSON.stringify({ error: 'Content not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      videoUrl = content.video_url;
      title = content.title;
      thumbnailUrl = content.thumbnail_url;
      duration = content.duration || 0;
      contentRating = content.content_rating;
    }

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: 'Video not available for download' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check existing download licenses for this user/device (limit to 25 downloads)
    const { count: existingLicenses } = await supabase
      .from('download_licenses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .eq('status', 'active');

    if ((existingLicenses || 0) >= 25) {
      return new Response(
        JSON.stringify({ error: 'Download limit reached (25 items)', code: 'LIMIT_REACHED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate encrypted content key (device-specific)
    const contentKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const contentKeyBase64 = btoa(String.fromCharCode(...contentKeyBytes));

    // Calculate expiry (30 days from now, or subscription expiry, whichever is sooner)
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const subscriptionExpiry = profile?.subscription_expiry ? new Date(profile.subscription_expiry) : thirtyDaysFromNow;
    const expiresAt = thirtyDaysFromNow < subscriptionExpiry ? thirtyDaysFromNow : subscriptionExpiry;

    // Estimate file size based on duration and quality
    const bitrateKbps: Record<string, number> = {
      '480p': 1500,
      '720p': 3000,
      '1080p': 6000,
    };
    const bitrate = bitrateKbps[preferredQuality] || 3000;
    const estimatedSize = Math.round((duration * bitrate * 1000) / 8); // bytes

    // Create or update license in database with pending status
    const downloadId = episodeId ? `${contentId}_${episodeId}` : contentId;
    
    const { error: licenseError } = await supabase
      .from('download_licenses')
      .upsert({
        user_id: user.id,
        content_id: contentId,
        episode_id: episodeId || null,
        device_id: deviceId,
        encrypted_key: contentKeyBase64,
        expires_at: expiresAt.toISOString(),
        quality: preferredQuality,
        total_size: estimatedSize,
        status: 'pending', // Start as pending, updated to completed when download finishes
        downloaded_at: null, // Set when download completes
        last_verified: new Date().toISOString(),
      }, {
        onConflict: 'user_id,content_id,episode_id,device_id',
      });

    if (licenseError) {
      console.error('[download-start] License error:', licenseError);
      return new Response(
        JSON.stringify({ error: 'Failed to create download license' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate download manifest
    const manifest = {
      id: downloadId,
      contentId,
      episodeId,
      title,
      episodeTitle,
      thumbnailUrl,
      duration,
      quality: preferredQuality,
      videoUrl,
      estimatedSize,
      contentRating, // Include content rating for kids filtering
      license: {
        expiresAt: expiresAt.getTime(),
        canPlayOffline: true,
        encryptedContentKey: contentKeyBase64,
      },
      createdAt: Date.now(),
    };

    console.log(`[download-start] Created manifest for ${downloadId}, size estimate: ${estimatedSize} bytes`);

    return new Response(
      JSON.stringify({ manifest }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[download-start] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
