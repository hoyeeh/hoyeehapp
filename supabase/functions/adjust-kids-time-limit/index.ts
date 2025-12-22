import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = "https://hoyeeh.com";

interface AdjustRequest {
  token: string;
  action: 'add15' | 'add30' | 'unlimited' | 'reset';
}

serve(async (req) => {
  // Handle both GET (from email links) and POST requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let token: string;
    let action: string;

    // Support both GET (email links) and POST requests
    if (req.method === 'GET') {
      const url = new URL(req.url);
      token = url.searchParams.get('token') || '';
      action = url.searchParams.get('action') || '';
    } else {
      const body = await req.json();
      token = body.token;
      action = body.action;
    }

    if (!token || !action) {
      return new Response(generateHtmlResponse('error', 'Missing required parameters'), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    // Decode and validate the token
    // Token format: base64(profileId:parentUserId:timestamp:action)
    let profileId: string;
    let parentUserId: string;
    let timestamp: number;

    try {
      const decoded = atob(token);
      const parts = decoded.split(':');
      if (parts.length < 3) throw new Error('Invalid token format');
      
      profileId = parts[0];
      parentUserId = parts[1];
      timestamp = parseInt(parts[2]);
      
      // Token expires after 24 hours
      const now = Date.now();
      const tokenAge = now - timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (tokenAge > maxAge) {
        return new Response(generateHtmlResponse('expired', 'This link has expired. Please use the Hoyeeh app to adjust time limits.'), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }
    } catch (e) {
      console.error('Token decode error:', e);
      return new Response(generateHtmlResponse('error', 'Invalid token'), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    // Verify the profile exists and belongs to the parent
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, name, user_id, daily_time_limit_minutes, time_watched_today_minutes')
      .eq('id', profileId)
      .eq('user_id', parentUserId)
      .eq('is_kids', true)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(generateHtmlResponse('error', 'Profile not found or access denied'), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    const currentLimit = profile.daily_time_limit_minutes || 60;
    const currentWatched = profile.time_watched_today_minutes || 0;
    let newLimit: number;
    let actionDescription: string;

    switch (action) {
      case 'add15':
        newLimit = currentLimit + 15;
        actionDescription = `Added 15 minutes to ${profile.name}'s daily limit (now ${newLimit} minutes)`;
        break;
      case 'add30':
        newLimit = currentLimit + 30;
        actionDescription = `Added 30 minutes to ${profile.name}'s daily limit (now ${newLimit} minutes)`;
        break;
      case 'unlimited':
        newLimit = 0; // 0 means unlimited
        actionDescription = `Set ${profile.name}'s daily limit to unlimited for today`;
        break;
      case 'reset':
        // Reset today's watch time
        const { error: resetError } = await supabase
          .from('user_profiles')
          .update({ 
            time_watched_today_minutes: 0,
            last_time_reset: new Date().toISOString().split('T')[0]
          })
          .eq('id', profileId);
        
        if (resetError) {
          console.error('Reset error:', resetError);
          return new Response(generateHtmlResponse('error', 'Failed to reset watch time'), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          });
        }
        
        return new Response(generateHtmlResponse('success', `${profile.name}'s watch time has been reset to 0 minutes. They can start watching again!`), {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      default:
        return new Response(generateHtmlResponse('error', 'Invalid action'), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
    }

    // Update the time limit
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ daily_time_limit_minutes: newLimit })
      .eq('id', profileId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(generateHtmlResponse('error', 'Failed to update time limit'), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    // Create notification for parent
    await supabase
      .from('notifications')
      .insert({
        user_id: parentUserId,
        title: 'Time Limit Updated',
        body: actionDescription,
        type: 'kids_settings',
      });

    console.log(`Time limit adjusted for profile ${profileId}: ${actionDescription}`);

    return new Response(generateHtmlResponse('success', actionDescription), {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });

  } catch (error: unknown) {
    console.error('Error in adjust-kids-time-limit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(generateHtmlResponse('error', errorMessage), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });
  }
});

function generateHtmlResponse(type: 'success' | 'error' | 'expired', message: string): string {
  const icon = type === 'success' ? '✅' : type === 'expired' ? '⏰' : '❌';
  const color = type === 'success' ? '#4ade80' : type === 'expired' ? '#fbbf24' : '#f87171';
  const title = type === 'success' ? 'Success!' : type === 'expired' ? 'Link Expired' : 'Error';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Hoyeeh</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #0a0a0a;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          max-width: 400px;
          background: #141414;
          border-radius: 16px;
          padding: 40px;
          text-align: center;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 24px;
        }
        h1 {
          color: ${color};
          font-size: 24px;
          margin-bottom: 16px;
        }
        p {
          color: #e0e0e0;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 32px;
        }
        .btn {
          display: inline-block;
          background: #ff6300;
          color: white;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: background 0.2s;
        }
        .btn:hover {
          background: #e55a00;
        }
        .logo {
          margin-bottom: 24px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="https://hoyeeh-videos.sfo3.cdn.digitaloceanspaces.com/logo/hoyeeh-logo-web.png" alt="Hoyeeh" height="40" class="logo">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="${BASE_URL}" class="btn">Open Hoyeeh</a>
      </div>
    </body>
    </html>
  `;
}