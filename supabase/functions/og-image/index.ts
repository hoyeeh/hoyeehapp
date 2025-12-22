import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const contentId = url.searchParams.get('id');
    const type = url.searchParams.get('type') || 'content'; // content, page, generic

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[OG-IMAGE] Generating OG image for type: ${type}, id: ${contentId}`);

    let title = 'Hoyeeh';
    let subtitle = "Africa's Premier Streaming Platform";
    let backgroundImage = '';
    let genre = '';
    let year = '';
    let rating = '';

    // Fetch content details if contentId provided
    if (type === 'content' && contentId) {
      const { data: content, error } = await supabase
        .from('content')
        .select('title, description, thumbnail_url, genre, year, rating, content_type')
        .eq('id', contentId)
        .single();

      if (error) {
        console.error('[OG-IMAGE] Error fetching content:', error);
      } else if (content) {
        title = content.title;
        subtitle = content.description?.substring(0, 100) || '';
        backgroundImage = content.thumbnail_url || '';
        genre = content.genre || '';
        year = content.year?.toString() || '';
        rating = content.rating || '';
      }
    }

    // Try to generate a dynamic OG image using AI
    try {
      const prompt = `Create a professional Open Graph social media preview image (1200x630 pixels) for a streaming service called "Hoyeeh". 
      
The image should feature:
- Title: "${title}"
- Subtitle: "${subtitle}"
${genre ? `- Genre badge: "${genre}"` : ''}
${year ? `- Year: "${year}"` : ''}
${rating ? `- Rating: "${rating}/10"` : ''}

Style requirements:
- Dark cinematic background with purple/gold accent colors
- Professional streaming service aesthetic similar to Netflix or Disney+
- The Hoyeeh brand prominently displayed
- Text should be large, readable, and well-contrasted
- Modern, sleek design with gradient overlays
- Aspect ratio: 1200x630 (1.91:1)

Make it visually striking and suitable for sharing on social media platforms like Twitter, Facebook, and LinkedIn.`;

      const messages = [{ role: "user" as const, content: prompt }];
      
      // Note: Image generation requires specific model support
      // This will use the shared AI client with fallback
      const { content: aiContent, provider } = await callAI(messages);
      console.log(`[OG-IMAGE] AI call successful using: ${provider}`);
      
      // For image generation, we'd need a model that supports it
      // For now, fall through to JSON response
    } catch (aiError) {
      console.error('[OG-IMAGE] AI generation error:', aiError);
    }

    // Fallback: Return JSON with OG data for client-side handling
    const ogData = {
      title,
      description: subtitle,
      image: backgroundImage || 'https://hoyeeh.com/og-default.png',
      url: contentId ? `https://hoyeeh.com/content/${contentId}` : 'https://hoyeeh.com',
      type: type === 'content' ? 'video.movie' : 'website',
      site_name: 'Hoyeeh',
      locale: 'en_US',
      ...(genre && { genre }),
      ...(year && { year }),
      ...(rating && { rating }),
    };

    console.log('[OG-IMAGE] Returning OG data JSON');

    return new Response(JSON.stringify(ogData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[OG-IMAGE] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate OG image',
        title: 'Hoyeeh',
        description: "Africa's Premier Streaming Platform",
        image: 'https://hoyeeh.com/og-default.png',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
