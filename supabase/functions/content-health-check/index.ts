import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  video_url: string | null;
  year: number | null;
  tmdb_id: number | null;
}

interface DuplicateGroup {
  title: string;
  contentType: string;
  items: ContentItem[];
}

interface HealthCheckResult {
  totalContent: number;
  totalEpisodes: number;
  contentWithoutUrl: number;
  episodesWithoutUrl: number;
  duplicateGroups: DuplicateGroup[];
  duplicateCount: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, urls, contentIds } = await req.json();

    console.log(`[content-health-check] Action: ${action}`);

    // Action: Get health summary
    if (action === "summary") {
      // Fetch all content
      const { data: content, error: contentError } = await supabase
        .from("content")
        .select("id, title, content_type, video_url, year, tmdb_id")
        .order("title");

      if (contentError) {
        console.error("[content-health-check] Content fetch error:", contentError);
        throw contentError;
      }

      // Fetch all episodes
      const { data: episodes, error: episodesError } = await supabase
        .from("episodes")
        .select("id, video_url");

      if (episodesError) {
        console.error("[content-health-check] Episodes fetch error:", episodesError);
        throw episodesError;
      }

      // Calculate metrics
      const contentWithoutUrl = (content || []).filter(c => !c.video_url || c.video_url.trim() === "").length;
      const episodesWithoutUrl = (episodes || []).filter(e => !e.video_url || e.video_url.trim() === "").length;

      // Find duplicates
      const titleMap = new Map<string, ContentItem[]>();
      (content || []).forEach((item: ContentItem) => {
        const key = `${item.title.toLowerCase().trim()}|${item.content_type}`;
        if (!titleMap.has(key)) {
          titleMap.set(key, []);
        }
        titleMap.get(key)!.push(item);
      });

      const duplicateGroups: DuplicateGroup[] = [];
      titleMap.forEach((items, key) => {
        if (items.length > 1) {
          duplicateGroups.push({
            title: items[0].title,
            contentType: items[0].content_type,
            items,
          });
        }
      });

      const result: HealthCheckResult = {
        totalContent: (content || []).length,
        totalEpisodes: (episodes || []).length,
        contentWithoutUrl,
        episodesWithoutUrl,
        duplicateGroups,
        duplicateCount: duplicateGroups.reduce((acc, g) => acc + g.items.length - 1, 0),
      };

      console.log(`[content-health-check] Summary: ${result.totalContent} content, ${result.duplicateCount} duplicates`);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Validate URLs
    if (action === "validate-urls" && urls) {
      console.log(`[content-health-check] Validating ${urls.length} URLs`);
      
      const results = await Promise.all(
        urls.map(async (url: string) => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(url, {
              method: "HEAD",
              signal: controller.signal,
            });
            
            clearTimeout(timeout);
            
            return {
              url,
              valid: response.ok,
              status: response.status,
              contentType: response.headers.get("content-type"),
            };
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            return {
              url,
              valid: false,
              error: errorMessage,
            };
          }
        })
      );

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Merge duplicates (keep one, delete others)
    if (action === "merge" && contentIds) {
      const { keepId, deleteIds } = contentIds;
      
      console.log(`[content-health-check] Merging: keep ${keepId}, delete ${deleteIds.length} items`);

      // Transfer watchlist entries
      for (const deleteId of deleteIds) {
        await supabase
          .from("watchlist")
          .update({ content_id: keepId })
          .eq("content_id", deleteId);
      }

      // Transfer watch history (with conflict handling)
      for (const deleteId of deleteIds) {
        // Get existing entries for the content to delete
        const { data: oldHistory } = await supabase
          .from("watch_history")
          .select("*")
          .eq("content_id", deleteId);

        if (oldHistory && oldHistory.length > 0) {
          for (const entry of oldHistory) {
            // Check if user already has history for kept content
            const { data: existingHistory } = await supabase
              .from("watch_history")
              .select("*")
              .eq("content_id", keepId)
              .eq("user_id", entry.user_id)
              .maybeSingle();

            if (!existingHistory) {
              // No existing entry, update to point to kept content
              await supabase
                .from("watch_history")
                .update({ content_id: keepId })
                .eq("id", entry.id);
            } else {
              // Entry exists, keep the one with higher progress
              if ((entry.progress || 0) > (existingHistory.progress || 0)) {
                await supabase
                  .from("watch_history")
                  .update({ progress: entry.progress, last_watched: entry.last_watched })
                  .eq("id", existingHistory.id);
              }
              // Delete the old entry
              await supabase
                .from("watch_history")
                .delete()
                .eq("id", entry.id);
            }
          }
        }
      }

      // Delete the duplicate content
      for (const deleteId of deleteIds) {
        // Delete related data first
        await supabase.from("reviews").delete().eq("content_id", deleteId);
        await supabase.from("top_10").delete().eq("content_id", deleteId);
        await supabase.from("section_content").delete().eq("content_id", deleteId);
        await supabase.from("kids_content_categories").delete().eq("content_id", deleteId);
        await supabase.from("notifications").delete().eq("content_id", deleteId);
        await supabase.from("hero_banners").delete().eq("content_id", deleteId);
        
        // Delete seasons and episodes
        const { data: seasons } = await supabase
          .from("seasons")
          .select("id")
          .eq("content_id", deleteId);
        
        if (seasons && seasons.length > 0) {
          for (const season of seasons) {
            await supabase.from("episodes").delete().eq("season_id", season.id);
          }
          await supabase.from("seasons").delete().eq("content_id", deleteId);
        }
        
        // Finally delete the content
        await supabase.from("content").delete().eq("id", deleteId);
      }

      console.log(`[content-health-check] Merge complete. Deleted ${deleteIds.length} duplicates`);

      return new Response(JSON.stringify({ success: true, deletedCount: deleteIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[content-health-check] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
