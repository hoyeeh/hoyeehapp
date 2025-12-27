import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contentId, action } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get content details
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      return new Response(
        JSON.stringify({ error: 'Content not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get view history stats
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count: recentViews } = await supabase
      .from('watch_history')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', contentId)
      .gte('watched_at', thirtyDaysAgo.toISOString());

    // Get similar content performance
    const { data: similarContent } = await supabase
      .from('content')
      .select('id, title, views_last_30_days, lifecycle_status')
      .eq('genre', content.genre)
      .neq('id', contentId)
      .limit(5);

    // Get lifecycle history
    const { data: lifecycleLogs } = await supabase
      .from('content_lifecycle_logs')
      .select('*')
      .eq('content_id', contentId)
      .order('created_at', { ascending: false })
      .limit(10);

    const prompt = `Analyze this streaming content for lifecycle management decisions:

CONTENT DETAILS:
- Title: ${content.title}
- Type: ${content.content_type}
- Genre: ${content.genre || 'Unknown'}
- Year: ${content.year || 'Unknown'}
- Current Status: ${content.lifecycle_status}
- Days until expiration: ${content.expires_at ? Math.ceil((new Date(content.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : 'N/A'}
- Views in last 30 days: ${recentViews || 0}
- Total view count: ${content.view_count || 0}
- Rating: ${content.rating || 'N/A'}

SIMILAR CONTENT PERFORMANCE:
${similarContent?.map(c => `- ${c.title}: ${c.views_last_30_days} views, status: ${c.lifecycle_status}`).join('\n') || 'No similar content found'}

LIFECYCLE HISTORY:
${lifecycleLogs?.map(l => `- ${l.created_at}: ${l.previous_status} → ${l.new_status} (${l.reason})`).join('\n') || 'No history'}

ACTION REQUESTED: ${action || 'general_analysis'}

Provide analysis as JSON with these keys:
- recommendation: "keep" | "hide" | "promote" | "no_action"
- confidence: number 0-100
- reasoning: string (brief explanation)
- promotionIdeas: array of strings (if recommendation is "promote")
- riskFactors: array of strings
- predictedViews: number (estimated views if promoted)`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    let analysis = null;
    if (textContent) {
      try {
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        }
      } catch {
        analysis = { raw: textContent };
      }
    }

    // Store the AI analysis in the content's lifecycle_reason
    if (analysis) {
      await supabase
        .from('content')
        .update({
          lifecycle_reason: JSON.stringify({
            lastAnalysis: new Date().toISOString(),
            ...analysis,
          }),
        })
        .eq('id', contentId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        content: {
          id: content.id,
          title: content.title,
          lifecycle_status: content.lifecycle_status,
          expires_at: content.expires_at,
          views_last_30_days: recentViews || 0,
        },
        analysis,
        similarContent: similarContent?.map(c => ({
          title: c.title,
          views: c.views_last_30_days,
          status: c.lifecycle_status,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in content-lifecycle-ai:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
