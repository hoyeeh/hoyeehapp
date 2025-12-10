import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a random 6-character pairing code
function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // ACTION: Generate pairing code for TV receiver
    if (action === 'generate-code') {
      const { deviceName, deviceType } = await req.json();
      
      // Create receiver record
      const { data: receiver, error: receiverError } = await supabase
        .from('cast_receivers')
        .insert({
          device_name: deviceName || 'Smart TV',
          device_type: deviceType || 'smart_tv',
        })
        .select()
        .single();

      if (receiverError) {
        console.error('Error creating receiver:', receiverError);
        throw receiverError;
      }

      // Generate unique pairing code
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

      // Create session with pairing code
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

      if (sessionError) {
        console.error('Error creating session:', sessionError);
        throw sessionError;
      }

      console.log('Generated pairing code:', pairingCode, 'for receiver:', receiver.id);

      return new Response(JSON.stringify({
        success: true,
        pairingCode,
        sessionId: session.id,
        receiverId: receiver.id,
        expiresAt: session.expires_at,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: Validate pairing code and connect controller
    if (action === 'pair') {
      const { pairingCode, userId } = await req.json();

      // Find pending session with this code
      const { data: session, error: sessionError } = await supabase
        .from('cast_sessions')
        .select('*, cast_receivers(*)')
        .eq('pairing_code', pairingCode.toUpperCase())
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (sessionError || !session) {
        console.log('Invalid or expired pairing code:', pairingCode);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid or expired pairing code',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update session to paired status
      const { error: updateError } = await supabase
        .from('cast_sessions')
        .update({
          status: 'paired',
          controller_user_id: userId || null,
          last_heartbeat: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (updateError) {
        console.error('Error updating session:', updateError);
        throw updateError;
      }

      console.log('Paired session:', session.id, 'with controller:', userId);

      return new Response(JSON.stringify({
        success: true,
        sessionId: session.id,
        receiverId: session.receiver_id,
        deviceName: session.cast_receivers?.device_name,
        deviceType: session.cast_receivers?.device_type,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: Send command to session
    if (action === 'command') {
      const { sessionId, command, payload } = await req.json();

      // Get current session
      const { data: session, error: sessionError } = await supabase
        .from('cast_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Session not found',
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update session based on command
      let updateData: Record<string, unknown> = {
        last_heartbeat: new Date().toISOString(),
      };

      switch (command) {
        case 'LOAD':
          updateData = {
            ...updateData,
            video_url: payload.videoUrl,
            video_title: payload.title,
            video_thumbnail: payload.thumbnail,
            playback_time: payload.startTime || 0,
            video_duration: payload.duration || 0,
            is_playing: true,
            status: 'active',
          };
          break;
        case 'PLAY':
          updateData.is_playing = true;
          break;
        case 'PAUSE':
          updateData.is_playing = false;
          break;
        case 'SEEK':
          updateData.playback_time = payload.time;
          break;
        case 'VOLUME':
          updateData.volume_level = payload.volume;
          break;
        case 'STOP':
          updateData = {
            ...updateData,
            is_playing: false,
            video_url: null,
            video_title: null,
            playback_time: 0,
          };
          break;
        case 'UPDATE_TIME':
          updateData.playback_time = payload.time;
          if (payload.duration) updateData.video_duration = payload.duration;
          break;
        case 'UPDATE_QUEUE':
          updateData.queue = payload.queue;
          break;
      }

      const { error: updateError } = await supabase
        .from('cast_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (updateError) {
        console.error('Error updating session:', updateError);
        throw updateError;
      }

      console.log('Command sent:', command, 'to session:', sessionId);

      return new Response(JSON.stringify({
        success: true,
        command,
        sessionId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: Get session status
    if (action === 'status') {
      const sessionId = url.searchParams.get('sessionId');

      const { data: session, error: sessionError } = await supabase
        .from('cast_sessions')
        .select('*, cast_receivers(*)')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Session not found',
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        session: {
          id: session.id,
          status: session.status,
          videoUrl: session.video_url,
          videoTitle: session.video_title,
          videoThumbnail: session.video_thumbnail,
          playbackTime: session.playback_time,
          duration: session.video_duration,
          isPlaying: session.is_playing,
          volume: session.volume_level,
          queue: session.queue,
          deviceName: session.cast_receivers?.device_name,
          lastHeartbeat: session.last_heartbeat,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: Heartbeat to keep session alive
    if (action === 'heartbeat') {
      const { sessionId, playbackTime, isPlaying } = await req.json();

      const updateData: Record<string, unknown> = {
        last_heartbeat: new Date().toISOString(),
      };

      if (playbackTime !== undefined) updateData.playback_time = playbackTime;
      if (isPlaying !== undefined) updateData.is_playing = isPlaying;

      const { error } = await supabase
        .from('cast_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (error) {
        console.error('Heartbeat error:', error);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ACTION: Disconnect session
    if (action === 'disconnect') {
      const { sessionId } = await req.json();

      const { error } = await supabase
        .from('cast_sessions')
        .update({ status: 'disconnected' })
        .eq('id', sessionId);

      if (error) {
        console.error('Disconnect error:', error);
      }

      console.log('Session disconnected:', sessionId);

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
