import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting for pairing attempts (in-memory, resets on function restart)
const pairingAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string, maxAttempts = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const record = pairingAttempts.get(identifier);
  
  if (!record || now > record.resetAt) {
    pairingAttempts.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (record.count >= maxAttempts) {
    return false;
  }
  
  record.count++;
  return true;
}

// Generate a random 6-character pairing code
function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get authenticated user from request
async function getAuthUser(req: Request, supabase: any) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';

    // Generate pairing code for TV receiver (no auth needed)
    if (action === 'generate-code') {
      const { deviceName, deviceType } = await req.json();
      
      const { data: receiver, error: receiverError } = await supabase
        .from('cast_receivers')
        .insert({ device_name: deviceName || 'Smart TV', device_type: deviceType || 'smart_tv' })
        .select()
        .single();

      if (receiverError) throw receiverError;

      let pairingCode = generatePairingCode();
      let attempts = 0;
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from('cast_sessions')
          .select('id')
          .eq('pairing_code', pairingCode)
          .eq('status', 'pending')
          .single();
        if (!existing) break;
        pairingCode = generatePairingCode();
        attempts++;
      }

      const { data: session, error: sessionError } = await supabase
        .from('cast_sessions')
        .insert({
          pairing_code: pairingCode,
          receiver_id: receiver.id,
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      console.log('Generated pairing code:', pairingCode);
      return new Response(JSON.stringify({
        success: true,
        pairingCode,
        sessionId: session.id,
        receiverId: receiver.id,
        expiresAt: session.expires_at,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Pair controller with receiver - REQUIRES AUTH + RATE LIMITING
    if (action === 'pair') {
      // Rate limit by IP
      if (!checkRateLimit(clientIp, 10, 60000)) {
        console.warn(`Rate limit exceeded for IP: ${clientIp}`);
        return new Response(JSON.stringify({ success: false, error: 'Too many attempts. Try again in a minute.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const user = await getAuthUser(req, supabase);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { pairingCode } = await req.json();

      const { data: session, error: sessionError } = await supabase
        .from('cast_sessions')
        .select('*, cast_receivers(*)')
        .eq('pairing_code', pairingCode.toUpperCase())
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid or expired pairing code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('cast_sessions')
        .update({ status: 'paired', controller_user_id: user.id, last_heartbeat: new Date().toISOString() })
        .eq('id', session.id);

      console.log('Paired session:', session.id, 'with user:', user.id);
      return new Response(JSON.stringify({
        success: true,
        sessionId: session.id,
        receiverId: session.receiver_id,
        deviceName: session.cast_receivers?.device_name,
        deviceType: session.cast_receivers?.device_type,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Send command - REQUIRES AUTH + SESSION OWNERSHIP
    if (action === 'command') {
      const user = await getAuthUser(req, supabase);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { sessionId, command, payload } = await req.json();

      // Verify session ownership
      const { data: session, error: sessionError } = await supabase
        .from('cast_sessions')
        .select('controller_user_id')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({ success: false, error: 'Session not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (session.controller_user_id !== user.id) {
        console.warn(`Unauthorized command by ${user.id} on session ${sessionId}`);
        return new Response(JSON.stringify({ success: false, error: 'Not authorized to control this session' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let updateData: Record<string, unknown> = { last_heartbeat: new Date().toISOString() };

      switch (command) {
        case 'LOAD':
          updateData = { ...updateData, video_url: payload.videoUrl, video_title: payload.title, video_thumbnail: payload.thumbnail, playback_time: payload.startTime || 0, video_duration: payload.duration || 0, is_playing: true, status: 'active' };
          break;
        case 'PLAY': updateData.is_playing = true; break;
        case 'PAUSE': updateData.is_playing = false; break;
        case 'SEEK': updateData.playback_time = payload.time; break;
        case 'VOLUME': updateData.volume_level = payload.volume; break;
        case 'STOP': updateData = { ...updateData, is_playing: false, video_url: null, video_title: null, playback_time: 0 }; break;
        case 'UPDATE_TIME': updateData.playback_time = payload.time; if (payload.duration) updateData.video_duration = payload.duration; break;
        case 'UPDATE_QUEUE': updateData.queue = payload.queue; break;
      }

      await supabase.from('cast_sessions').update(updateData).eq('id', sessionId);
      return new Response(JSON.stringify({ success: true, command, sessionId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get session status - receiver polling (no strict auth for pending sessions)
    if (action === 'status') {
      const sessionId = url.searchParams.get('sessionId');
      const { data: session, error } = await supabase
        .from('cast_sessions')
        .select('*, cast_receivers(*)')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return new Response(JSON.stringify({ success: false, error: 'Session not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // For active sessions, verify ownership if user is authenticated
      if (session.status !== 'pending') {
        const user = await getAuthUser(req, supabase);
        if (user && session.controller_user_id && session.controller_user_id !== user.id) {
          return new Response(JSON.stringify({ success: false, error: 'Not authorized' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        session: {
          id: session.id, status: session.status, videoUrl: session.video_url,
          videoTitle: session.video_title, videoThumbnail: session.video_thumbnail,
          playbackTime: session.playback_time, duration: session.video_duration,
          isPlaying: session.is_playing, volume: session.volume_level, queue: session.queue,
          deviceName: session.cast_receivers?.device_name, lastHeartbeat: session.last_heartbeat,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Heartbeat (receiver only, no auth needed)
    if (action === 'heartbeat') {
      const { sessionId, playbackTime, isPlaying } = await req.json();
      const updateData: Record<string, unknown> = { last_heartbeat: new Date().toISOString() };
      if (playbackTime !== undefined) updateData.playback_time = playbackTime;
      if (isPlaying !== undefined) updateData.is_playing = isPlaying;

      await supabase.from('cast_sessions').update(updateData).eq('id', sessionId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Disconnect - REQUIRES AUTH for owned sessions
    if (action === 'disconnect') {
      const { sessionId } = await req.json();
      const user = await getAuthUser(req, supabase);

      const { data: session } = await supabase.from('cast_sessions').select('controller_user_id').eq('id', sessionId).single();

      // Allow disconnect if owner or receiver (no controller yet)
      if (session?.controller_user_id && user?.id !== session.controller_user_id) {
        return new Response(JSON.stringify({ success: false, error: 'Not authorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('cast_sessions').update({ status: 'disconnected' }).eq('id', sessionId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Cast signaling error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});