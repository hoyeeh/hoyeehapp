import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContentItem {
  id: string;
  title: string;
  lifecycle_status: string;
  expires_at: string;
  admin_override: boolean;
  views_last_30_days: number;
  created_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting content lifecycle check...');

    // Get all content that's not admin overridden
    const { data: allContent, error: contentError } = await supabase
      .from('content')
      .select('id, title, lifecycle_status, expires_at, admin_override, views_last_30_days, created_at')
      .eq('admin_override', false);

    if (contentError) {
      console.error('Error fetching content:', contentError);
      throw contentError;
    }

    console.log(`Processing ${allContent?.length || 0} content items...`);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const results = {
      updated: [] as string[],
      hidden: [] as string[],
      kept: [] as string[],
      leavingSoon: [] as string[],
    };

    for (const content of allContent || []) {
      const expiresAt = new Date(content.expires_at);
      const previousStatus = content.lifecycle_status;

      // Calculate views in last 30 days from watch_history
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const { count: viewCount } = await supabase
        .from('watch_history')
        .select('*', { count: 'exact', head: true })
        .eq('content_id', content.id)
        .gte('watched_at', thirtyDaysAgo.toISOString());

      const views = viewCount || 0;

      // Update views_last_30_days cache
      await supabase
        .from('content')
        .update({ views_last_30_days: views })
        .eq('id', content.id);

      let newStatus = previousStatus;
      let reason = '';

      // Check if content has expired
      if (expiresAt <= now) {
        if (views >= 50) {
          // Keep the content and extend by 90 days
          newStatus = 'kept';
          reason = `Content kept due to high engagement (${views} views in last 30 days). Expiration extended by 90 days.`;
          
          const newExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          await supabase
            .from('content')
            .update({
              lifecycle_status: 'kept',
              expires_at: newExpiresAt.toISOString(),
              lifecycle_updated_at: now.toISOString(),
              lifecycle_reason: reason,
            })
            .eq('id', content.id);

          results.kept.push(content.title);
        } else {
          // Hide the content
          newStatus = 'hidden';
          reason = `Content hidden due to low engagement (${views} views in last 30 days, threshold: 50).`;
          
          await supabase
            .from('content')
            .update({
              lifecycle_status: 'hidden',
              lifecycle_updated_at: now.toISOString(),
              lifecycle_reason: reason,
            })
            .eq('id', content.id);

          results.hidden.push(content.title);
        }
      } else if (expiresAt <= thirtyDaysFromNow && previousStatus === 'active') {
        // Mark as leaving soon
        newStatus = 'leaving_soon';
        const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        reason = `Content marked as leaving soon. ${daysRemaining} days remaining. Current views: ${views}.`;
        
        await supabase
          .from('content')
          .update({
            lifecycle_status: 'leaving_soon',
            lifecycle_updated_at: now.toISOString(),
            lifecycle_reason: reason,
          })
          .eq('id', content.id);

        results.leavingSoon.push(content.title);
      }

      // Log status change if it occurred
      if (newStatus !== previousStatus) {
        await supabase.from('content_lifecycle_logs').insert({
          content_id: content.id,
          previous_status: previousStatus,
          new_status: newStatus,
          reason: reason,
          changed_by: 'system',
        });

        results.updated.push(content.title);
      }
    }

    // Get AI insights using Gemini
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    let aiInsights = null;

    if (geminiApiKey && (results.hidden.length > 0 || results.leavingSoon.length > 0)) {
      try {
        const prompt = `Analyze the following content lifecycle changes for a streaming platform:
        
Hidden due to low views: ${results.hidden.join(', ') || 'None'}
Leaving Soon: ${results.leavingSoon.join(', ') || 'None'}
Kept due to popularity: ${results.kept.join(', ') || 'None'}

Provide brief insights on:
1. Any patterns in the hidden content
2. Recommendations for promoting "Leaving Soon" content
3. What made the "kept" content successful

Keep response under 200 words and format as JSON with keys: patterns, recommendations, successFactors`;

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

        if (response.ok) {
          const data = await response.json();
          const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textContent) {
            // Try to parse as JSON, fallback to raw text
            try {
              const jsonMatch = textContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                aiInsights = JSON.parse(jsonMatch[0]);
              }
            } catch {
              aiInsights = { raw: textContent };
            }
          }
        }
      } catch (aiError) {
        console.error('AI analysis error:', aiError);
      }
    }

    console.log('Lifecycle check complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        aiInsights,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in content-lifecycle-manager:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
