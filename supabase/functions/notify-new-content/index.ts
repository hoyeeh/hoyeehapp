import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
  type: "new_movie" | "new_tvshow" | "new_episode" | "new_season";
  contentId: string;
  contentTitle: string;
  thumbnailUrl?: string;
  description?: string;
  genre?: string;
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
}

// Function to replace template variables
function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  
  // Handle conditional blocks {{#if variable}}...{{/if}}
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(conditionalRegex, (match, varName, content) => {
    return variables[varName] ? content : '';
  });
  
  // Replace simple variables {{variable}}
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value?.toString() || '');
  });
  
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: NotifyRequest = await req.json();
    const { type, contentId, contentTitle, thumbnailUrl, description, genre, year, seasonNumber, episodeNumber, episodeTitle } = requestData;

    if (!type || !contentId || !contentTitle) {
      return new Response(
        JSON.stringify({ error: "type, contentId, and contentTitle are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[notify-new-content] Processing ${type} notification for: ${contentTitle}`);

    // Determine template key based on notification type
    let templateKey: string;
    switch (type) {
      case "new_movie":
        templateKey = "new_movie_added";
        break;
      case "new_tvshow":
        templateKey = "new_tvshow_added";
        break;
      case "new_episode":
        templateKey = "new_episode_added";
        break;
      case "new_season":
        templateKey = "new_season_added";
        break;
      default:
        templateKey = "new_movie_added";
    }

    // Fetch the email template from database
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('subject, html_content, is_active')
      .eq('template_key', templateKey)
      .single();

    if (templateError || !template) {
      console.log(`[notify-new-content] Template ${templateKey} not found, using fallback`);
    }

    if (template && !template.is_active) {
      console.log(`[notify-new-content] Template ${templateKey} is disabled, skipping notification`);
      return new Response(
        JSON.stringify({ success: true, message: "Template is disabled", emailsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all users with new_releases notifications enabled
    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('new_releases', true);

    if (prefError) {
      console.error('[notify-new-content] Error fetching notification preferences:', prefError);
      throw prefError;
    }

    if (!preferences || preferences.length === 0) {
      console.log('[notify-new-content] No users with new_releases notifications enabled');
      return new Response(
        JSON.stringify({ success: true, message: "No users to notify", emailsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = preferences.map(p => p.user_id);
    console.log(`[notify-new-content] Found ${userIds.length} users with notifications enabled`);

    // Get user emails from auth.users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('[notify-new-content] Error fetching users:', usersError);
      throw usersError;
    }

    // Filter to only users who have notifications enabled
    const usersToNotify = users.users.filter(user => userIds.includes(user.id) && user.email);
    console.log(`[notify-new-content] Will notify ${usersToNotify.length} users`);

    if (usersToNotify.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No valid emails to notify", emailsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare template variables
    const watchUrl = `https://hoyeeh.com/content/${contentId}`;
    const templateVariables = {
      contentTitle,
      thumbnailUrl: thumbnailUrl || '',
      description: description || '',
      watchUrl,
      genre: genre || '',
      year: year?.toString() || '',
      seasonNumber: seasonNumber?.toString() || '',
      episodeNumber: episodeNumber?.toString() || '',
      episodeTitle: episodeTitle || '',
    };

    // Generate email content
    let subject: string;
    let html: string;

    if (template) {
      subject = replaceTemplateVariables(template.subject, templateVariables);
      html = replaceTemplateVariables(template.html_content, templateVariables);
    } else {
      // Fallback templates if database template not found
      const thumbnailHtml = thumbnailUrl 
        ? `<div style="text-align: center; margin: 24px 0;"><img src="${thumbnailUrl}" alt="${contentTitle}" style="max-width: 100%; border-radius: 8px; max-height: 200px; object-fit: cover;"></div>` 
        : '';
      
      const contentTypeName = type === 'new_movie' ? 'movie' : type === 'new_tvshow' ? 'TV show' : type === 'new_episode' ? 'episode' : 'season';
      const emoji = type === 'new_movie' ? '🎬' : '📺';
      
      subject = `${emoji} New ${contentTypeName === 'movie' ? 'Movie' : 'Series'} Alert: "${contentTitle}" is now streaming!`;
      html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <p style="color: #ff6300; font-size: 36px; font-weight: 700; margin: 0; letter-spacing: -1px;">Hoyeeh</p>
    </div>
    <div style="background-color: #141414; border-radius: 12px; padding: 32px;">
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">New ${contentTypeName.charAt(0).toUpperCase() + contentTypeName.slice(1)} Just Dropped! ${emoji}</h1>
      ${thumbnailHtml}
      <p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Great news! A new ${contentTypeName} is now available on Hoyeeh:</p>
      <p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;"><span style="color: #ff6300; font-weight: 600;">${contentTitle}</span></p>
      ${description ? `<p style="color: #888; font-size: 14px; line-height: 22px; margin: 0 0 16px 0;">${description}</p>` : ''}
      <p style="color: #e0e0e0; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">Be one of the first to watch this exciting new addition to our library!</p>
      <div style="text-align: center;">
        <a href="${watchUrl}" style="display: inline-block; background-color: #ff6300; border-radius: 8px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; text-align: center; padding: 14px 32px; margin: 24px 0;">Watch Now</a>
      </div>
      <p style="color: #888; font-size: 14px; margin: 16px 0 0 0;">Enjoy your viewing experience on Hoyeeh!</p>
    </div>
    <hr style="border-color: #333; margin: 32px 0;">
    <div style="text-align: center;">
      <p style="color: #666; font-size: 12px; margin: 0 0 8px 0;">© ${new Date().getFullYear()} Hoyeeh. All rights reserved.</p>
      <p style="color: #666; font-size: 12px; margin: 0;">
        <a href="https://hoyeeh.com" style="color: #ff6300; text-decoration: none;">Visit Hoyeeh</a>
        &bull;
        <a href="https://hoyeeh.com/notifications" style="color: #ff6300; text-decoration: none;">Email Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
    }

    // Send emails in batches to avoid rate limits
    const batchSize = 50;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < usersToNotify.length; i += batchSize) {
      const batch = usersToNotify.slice(i, i + batchSize);
      const emails = batch.map(user => user.email!);
      
      try {
        // Send to batch using BCC for privacy
        const { data, error } = await resend.emails.send({
          from: "Hoyeeh <noreply@hoyeeh.com>",
          to: ["noreply@hoyeeh.com"], // Dummy recipient
          bcc: emails,
          subject,
          html,
        });

        if (error) {
          console.error(`[notify-new-content] Batch ${i / batchSize + 1} failed:`, error);
          totalFailed += emails.length;
        } else {
          console.log(`[notify-new-content] Batch ${i / batchSize + 1} sent successfully`);
          totalSent += emails.length;

          // Log emails sent
          const emailLogs = batch.map(user => ({
            recipient_email: user.email!,
            user_id: user.id,
            template_type: templateKey,
            subject,
            status: 'sent',
            message_id: data?.id || null,
            metadata: { contentId, contentTitle, type },
          }));

          await supabase.from('email_logs').insert(emailLogs);
        }
      } catch (batchError) {
        console.error(`[notify-new-content] Batch ${i / batchSize + 1} error:`, batchError);
        totalFailed += emails.length;
      }

      // Small delay between batches to respect rate limits
      if (i + batchSize < usersToNotify.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Create in-app notifications
    const notificationType = type === 'new_movie' ? 'new_movie' : type === 'new_tvshow' ? 'new_tvshow' : type === 'new_episode' ? 'new_episode' : 'new_season';
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title: subject.replace(/[🎬📺🎉]/g, '').trim(),
      body: `${contentTitle} is now available on Hoyeeh!`,
      type: notificationType,
      content_id: contentId,
      read: false,
    }));

    const { error: notifyError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notifyError) {
      console.error('[notify-new-content] Error creating in-app notifications:', notifyError);
    }

    console.log(`[notify-new-content] Complete. Emails sent: ${totalSent}, Failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent: totalSent,
        emailsFailed: totalFailed,
        inAppNotifications: notifications.length,
        templateUsed: template ? templateKey : 'fallback',
        message: `Notified ${totalSent} users via email` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[notify-new-content] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});