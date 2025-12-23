import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ScreenMirrorState {
  isSupported: boolean;
  isCapturing: boolean;
  isConnected: boolean;
  sessionId: string | null;
  pairingCode: string | null;
  connectionUrl: string | null;
  error: string | null;
}

interface UseScreenMirrorOptions {
  onConnectionChange?: (connected: boolean) => void;
}

// WebRTC configuration for screen sharing
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useScreenMirror(options: UseScreenMirrorOptions = {}) {
  const { onConnectionChange } = options;

  const [state, setState] = useState<ScreenMirrorState>({
    isSupported: typeof navigator !== 'undefined' && 
      'mediaDevices' in navigator && 
      'getDisplayMedia' in navigator.mediaDevices,
    isCapturing: false,
    isConnected: false,
    sessionId: null,
    pairingCode: null,
    connectionUrl: null,
    error: null,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up resources
  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Create a screen mirror session
  const createSession = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Generate pairing code via edge function
      const { data, error } = await supabase.functions.invoke('cast-signaling', {
        body: {
          action: 'generate-code',
          deviceName: 'Screen Mirror Host',
          deviceType: 'screen_mirror',
        },
      });

      if (error) throw error;

      const baseUrl = window.location.origin;
      const connectionUrl = `${baseUrl}/tv?mode=mirror&session=${data.sessionId}`;

      setState(prev => ({
        ...prev,
        sessionId: data.sessionId,
        pairingCode: data.pairingCode,
        connectionUrl,
      }));

      // Start polling for receiver connection
      startPollingForReceiver(data.sessionId);

      return {
        sessionId: data.sessionId,
        pairingCode: data.pairingCode,
        connectionUrl,
      };
    } catch (error) {
      console.error('[ScreenMirror] Create session error:', error);
      setState(prev => ({ ...prev, error: 'Failed to create mirror session' }));
      toast.error('Failed to create screen mirror session');
      return null;
    }
  }, []);

  // Poll for receiver to connect
  const startPollingForReceiver = useCallback((sessionId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke('cast-signaling', {
          body: { action: 'status', sessionId },
        });

        if (data?.session?.status === 'paired' || data?.session?.status === 'active') {
          // Receiver connected, now we can start screen capture
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          
          setState(prev => ({ ...prev, isConnected: true }));
          onConnectionChange?.(true);
          toast.success('TV connected! Starting screen share...');
          
          // Auto-start screen capture when receiver connects
          await startScreenCapture(sessionId);
        }
      } catch (error) {
        console.error('[ScreenMirror] Polling error:', error);
      }
    }, 2000);
  }, [onConnectionChange]);

  // Start screen capture
  const startScreenCapture = useCallback(async (sessionId?: string) => {
    const activeSessionId = sessionId || state.sessionId;
    
    if (!activeSessionId) {
      toast.error('No active session');
      return false;
    }

    if (!state.isSupported) {
      toast.error('Screen sharing not supported in this browser');
      return false;
    }

    try {
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      mediaStreamRef.current = stream;

      // Handle stream end (user stops sharing)
      stream.getVideoTracks()[0].onended = () => {
        console.log('[ScreenMirror] Screen share stopped by user');
        stopScreenCapture();
      };

      // Set up WebRTC peer connection
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create data channel for signaling
      const dataChannel = pc.createDataChannel('mirror-control');
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log('[ScreenMirror] Data channel opened');
      };

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          // Send ICE candidate to receiver via signaling
          await supabase.functions.invoke('cast-signaling', {
            body: {
              action: 'command',
              sessionId: activeSessionId,
              command: 'ICE_CANDIDATE',
              payload: event.candidate,
            },
          });
        }
      };

      // Create and set local offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to receiver via signaling
      await supabase.functions.invoke('cast-signaling', {
        body: {
          action: 'command',
          sessionId: activeSessionId,
          command: 'MIRROR_OFFER',
          payload: {
            sdp: offer.sdp,
            type: offer.type,
          },
        },
      });

      // Start polling for answer
      startPollingForAnswer(activeSessionId, pc);

      setState(prev => ({ ...prev, isCapturing: true }));
      toast.success('Screen sharing started!');
      return true;
    } catch (error) {
      console.error('[ScreenMirror] Screen capture error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        toast.error('Screen share permission denied');
      } else {
        toast.error('Failed to start screen sharing');
      }
      
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [state.sessionId, state.isSupported]);

  // Poll for WebRTC answer from receiver
  const startPollingForAnswer = useCallback((sessionId: string, pc: RTCPeerConnection) => {
    const answerPollInterval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke('cast-signaling', {
          body: { action: 'status', sessionId },
        });

        // Check for answer in session data
        if (data?.session?.mirror_answer) {
          clearInterval(answerPollInterval);
          
          const answer = data.session.mirror_answer;
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('[ScreenMirror] Answer received and set');
        }

        // Check for ICE candidates
        if (data?.session?.remote_ice_candidates) {
          for (const candidate of data.session.remote_ice_candidates) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } catch (error) {
        console.error('[ScreenMirror] Answer polling error:', error);
      }
    }, 1000);

    // Stop polling after 30 seconds
    setTimeout(() => {
      clearInterval(answerPollInterval);
    }, 30000);
  }, []);

  // Stop screen capture
  const stopScreenCapture = useCallback(() => {
    cleanup();
    
    setState(prev => ({
      ...prev,
      isCapturing: false,
      isConnected: false,
    }));
    
    onConnectionChange?.(false);
    toast.info('Screen sharing stopped');
  }, [cleanup, onConnectionChange]);

  // Disconnect session
  const disconnect = useCallback(async () => {
    if (state.sessionId) {
      try {
        await supabase.functions.invoke('cast-signaling', {
          body: {
            action: 'disconnect',
            sessionId: state.sessionId,
          },
        });
      } catch (error) {
        console.error('[ScreenMirror] Disconnect error:', error);
      }
    }

    cleanup();
    
    setState({
      isSupported: state.isSupported,
      isCapturing: false,
      isConnected: false,
      sessionId: null,
      pairingCode: null,
      connectionUrl: null,
      error: null,
    });
    
    onConnectionChange?.(false);
  }, [state.sessionId, state.isSupported, cleanup, onConnectionChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    createSession,
    startScreenCapture,
    stopScreenCapture,
    disconnect,
  };
}
