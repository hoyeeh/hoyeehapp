import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Delete expired cast sessions (expired_at passed)
    const { data: expiredSessions, error: expiredError } = await supabase
      .from('cast_sessions')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (expiredError) {
      console.error('Error deleting expired sessions:', expiredError);
    } else {
      console.log(`Deleted ${expiredSessions?.length || 0} expired sessions`);
    }

    // 2. Delete disconnected sessions older than 1 hour
    const { data: disconnectedSessions, error: disconnectedError } = await supabase
      .from('cast_sessions')
      .delete()
      .eq('status', 'disconnected')
      .lt('last_heartbeat', oneHourAgo)
      .select('id');

    if (disconnectedError) {
      console.error('Error deleting disconnected sessions:', disconnectedError);
    } else {
      console.log(`Deleted ${disconnectedSessions?.length || 0} disconnected sessions`);
    }

    // 3. Delete pending sessions that were never paired (older than 1 hour)
    const { data: stalePendingSessions, error: stalePendingError } = await supabase
      .from('cast_sessions')
      .delete()
      .eq('status', 'pending')
      .lt('created_at', oneHourAgo)
      .select('id');

    if (stalePendingError) {
      console.error('Error deleting stale pending sessions:', stalePendingError);
    } else {
      console.log(`Deleted ${stalePendingSessions?.length || 0} stale pending sessions`);
    }

    // 4. Delete inactive cast receivers (no activity in 24 hours)
    const { data: inactiveReceivers, error: inactiveError } = await supabase
      .from('cast_receivers')
      .delete()
      .lt('last_active', oneDayAgo)
      .select('id');

    if (inactiveError) {
      console.error('Error deleting inactive receivers:', inactiveError);
    } else {
      console.log(`Deleted ${inactiveReceivers?.length || 0} inactive receivers`);
    }

    // 5. Mark active sessions as disconnected if no heartbeat in 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: staleActiveSessions, error: staleActiveError } = await supabase
      .from('cast_sessions')
      .update({ status: 'disconnected' })
      .eq('status', 'active')
      .lt('last_heartbeat', fiveMinutesAgo)
      .select('id');

    if (staleActiveError) {
      console.error('Error marking stale active sessions:', staleActiveError);
    } else {
      console.log(`Marked ${staleActiveSessions?.length || 0} stale sessions as disconnected`);
    }

    const summary = {
      expiredSessionsDeleted: expiredSessions?.length || 0,
      disconnectedSessionsDeleted: disconnectedSessions?.length || 0,
      stalePendingSessionsDeleted: stalePendingSessions?.length || 0,
      inactiveReceiversDeleted: inactiveReceivers?.length || 0,
      staleActiveSessionsMarked: staleActiveSessions?.length || 0,
      cleanupTime: now,
    };

    console.log('Cleanup summary:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cleanup job error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
