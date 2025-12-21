/**
 * Widevine/Clear Key EME Integration Hook
 * Implements Encrypted Media Extensions for software-based DRM (L3 equivalent)
 * Uses Clear Key CDM for custom in-house DRM without external certification
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Key system configurations
const KEY_SYSTEMS = {
  clearkey: 'org.w3.clearkey',
  widevine: 'com.widevine.alpha',
  fairplay: 'com.apple.fps.1_0',
  playready: 'com.microsoft.playready',
} as const;

interface EMEConfig {
  contentId: string;
  episodeId?: string;
  onError?: (error: string) => void;
  onLicenseAcquired?: () => void;
  onKeyStatusChange?: (status: string) => void;
}

interface KeyInfo {
  keyId: Uint8Array;
  key: Uint8Array;
  status: MediaKeyStatus;
}

interface EMEState {
  isSupported: boolean;
  activeKeySystem: string | null;
  keyStatus: MediaKeyStatus | null;
  hasLicense: boolean;
  isInitialized: boolean;
}

// Convert hex string to Uint8Array
const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

// Convert Uint8Array to base64url
const bytesToBase64url = (bytes: Uint8Array): string => {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Convert base64url to Uint8Array
const base64urlToBytes = (base64url: string): Uint8Array => {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Generate a secure random key ID
const generateKeyId = (): Uint8Array => {
  const keyId = new Uint8Array(16);
  crypto.getRandomValues(keyId);
  return keyId;
};

export const useWidevineEME = (config: EMEConfig) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaKeysRef = useRef<MediaKeys | null>(null);
  const keySessionRef = useRef<MediaKeySession | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  
  const [emeState, setEmeState] = useState<EMEState>({
    isSupported: false,
    activeKeySystem: null,
    keyStatus: null,
    hasLicense: false,
    isInitialized: false,
  });

  // Check EME support and select best key system
  const checkEMESupport = useCallback(async (): Promise<string | null> => {
    if (typeof navigator.requestMediaKeySystemAccess !== 'function') {
      console.log('EME not supported in this browser');
      return null;
    }

    const keySystemConfig: MediaKeySystemConfiguration[] = [{
      initDataTypes: ['cenc', 'keyids', 'webm'],
      videoCapabilities: [
        { contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: '' },
        { contentType: 'video/mp4; codecs="avc1.4D401E"', robustness: '' },
        { contentType: 'video/webm; codecs="vp8"', robustness: '' },
        { contentType: 'video/webm; codecs="vp9"', robustness: '' },
      ],
      audioCapabilities: [
        { contentType: 'audio/mp4; codecs="mp4a.40.2"', robustness: '' },
        { contentType: 'audio/webm; codecs="opus"', robustness: '' },
      ],
      persistentState: 'optional',
      distinctiveIdentifier: 'optional',
      sessionTypes: ['temporary'],
    }];

    // Try Clear Key first (always available, our custom implementation)
    try {
      await navigator.requestMediaKeySystemAccess(KEY_SYSTEMS.clearkey, keySystemConfig);
      console.log('Clear Key CDM available');
      return KEY_SYSTEMS.clearkey;
    } catch (e) {
      console.log('Clear Key not available:', e);
    }

    // Try Widevine (Chrome, Firefox, Edge on most platforms)
    try {
      await navigator.requestMediaKeySystemAccess(KEY_SYSTEMS.widevine, keySystemConfig);
      console.log('Widevine CDM available');
      return KEY_SYSTEMS.widevine;
    } catch (e) {
      console.log('Widevine not available:', e);
    }

    // Try PlayReady (Edge on Windows)
    try {
      await navigator.requestMediaKeySystemAccess(KEY_SYSTEMS.playready, keySystemConfig);
      console.log('PlayReady CDM available');
      return KEY_SYSTEMS.playready;
    } catch (e) {
      console.log('PlayReady not available:', e);
    }

    return null;
  }, []);

  // Generate session token
  const generateSessionToken = useCallback((): string => {
    const timestamp = Date.now();
    const random = crypto.getRandomValues(new Uint8Array(16));
    const randomStr = Array.from(random).map(b => b.toString(16).padStart(2, '0')).join('');
    const userId = user?.id || 'anonymous';
    return btoa(`${userId}:${timestamp}:${randomStr}:${config.contentId}`);
  }, [user?.id, config.contentId]);

  // Fetch content key from license server
  const fetchContentKey = useCallback(async (keyId: Uint8Array): Promise<Uint8Array | null> => {
    if (!user) {
      config.onError?.('User not authenticated');
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('drm-license-server', {
        body: {
          contentId: config.contentId,
          episodeId: config.episodeId,
          action: 'get-content-key',
          sessionToken: sessionTokenRef.current,
          keyId: bytesToBase64url(keyId),
        },
      });

      if (error) throw error;

      if (data?.contentKey) {
        // Decode the content key from base64url
        return base64urlToBytes(data.contentKey);
      }

      return null;
    } catch (err) {
      console.error('Failed to fetch content key:', err);
      config.onError?.('Failed to acquire content decryption key');
      return null;
    }
  }, [user, config]);

  // Handle license request for Clear Key
  const handleClearKeyLicenseRequest = useCallback(async (
    session: MediaKeySession,
    message: ArrayBuffer
  ): Promise<void> => {
    try {
      // Parse the license request
      const request = JSON.parse(new TextDecoder().decode(message));
      console.log('Clear Key license request:', request);

      // Extract key IDs from the request
      const keyIds: Uint8Array[] = [];
      if (request.kids) {
        for (const kid of request.kids) {
          keyIds.push(base64urlToBytes(kid));
        }
      } else {
        // Generate a key ID if not provided
        keyIds.push(generateKeyId());
      }

      // Fetch content keys from our license server
      const keys: { kty: string; k: string; kid: string }[] = [];
      
      for (const keyId of keyIds) {
        const contentKey = await fetchContentKey(keyId);
        if (contentKey) {
          keys.push({
            kty: 'oct',
            k: bytesToBase64url(contentKey),
            kid: bytesToBase64url(keyId),
          });
        }
      }

      if (keys.length === 0) {
        throw new Error('No content keys obtained from license server');
      }

      // Create Clear Key license response
      const license = {
        keys,
        type: request.type || 'temporary',
      };

      const licenseBytes = new TextEncoder().encode(JSON.stringify(license));
      
      // Update the session with the license
      await session.update(licenseBytes);
      
      console.log('Clear Key license installed successfully');
      setEmeState(prev => ({ ...prev, hasLicense: true }));
      config.onLicenseAcquired?.();
      
    } catch (err) {
      console.error('Failed to handle Clear Key license request:', err);
      config.onError?.('Failed to install content decryption license');
    }
  }, [fetchContentKey, config]);

  // Handle key status change
  const handleKeyStatusChange = useCallback((session: MediaKeySession) => {
    session.keyStatuses.forEach((status: MediaKeyStatus, keyId: BufferSource) => {
      console.log('Key status change:', status);
      setEmeState(prev => ({ ...prev, keyStatus: status }));
      config.onKeyStatusChange?.(status);

      if (status === 'expired' || status === 'internal-error') {
        config.onError?.(`Key status: ${status}`);
      }
    });
  }, [config]);

  // Initialize EME for a video element
  const initializeEME = useCallback(async (video: HTMLVideoElement): Promise<boolean> => {
    if (!video) {
      console.error('No video element provided');
      return false;
    }

    videoRef.current = video;
    sessionTokenRef.current = generateSessionToken();

    // Check for EME support
    const keySystem = await checkEMESupport();
    if (!keySystem) {
      console.log('No supported key system found, falling back to unprotected playback');
      setEmeState(prev => ({ ...prev, isSupported: false, isInitialized: true }));
      return false;
    }

    setEmeState(prev => ({ ...prev, isSupported: true, activeKeySystem: keySystem }));

    try {
      // Request media key system access
      const keySystemConfig: MediaKeySystemConfiguration[] = [{
        initDataTypes: ['cenc', 'keyids', 'webm'],
        videoCapabilities: [
          { contentType: 'video/mp4; codecs="avc1.42E01E"', robustness: '' },
          { contentType: 'video/mp4; codecs="avc1.4D401E"', robustness: '' },
        ],
        audioCapabilities: [
          { contentType: 'audio/mp4; codecs="mp4a.40.2"', robustness: '' },
        ],
        persistentState: 'optional',
        distinctiveIdentifier: 'optional',
        sessionTypes: ['temporary'],
      }];

      const keySystemAccess = await navigator.requestMediaKeySystemAccess(keySystem, keySystemConfig);
      const mediaKeys = await keySystemAccess.createMediaKeys();
      
      await video.setMediaKeys(mediaKeys);
      mediaKeysRef.current = mediaKeys;

      // Listen for encrypted event
      video.addEventListener('encrypted', async (event: MediaEncryptedEvent) => {
        console.log('Encrypted event received:', event.initDataType);
        
        try {
          // Create a new key session
          const session = mediaKeys.createSession('temporary');
          keySessionRef.current = session;

          // Listen for messages (license requests)
          session.addEventListener('message', async (messageEvent: MediaKeyMessageEvent) => {
            console.log('Key session message:', messageEvent.messageType);
            
            if (messageEvent.messageType === 'license-request') {
              if (keySystem === KEY_SYSTEMS.clearkey) {
                await handleClearKeyLicenseRequest(session, messageEvent.message);
              } else {
                // For Widevine/PlayReady, send to external license server
                // This would require integration with a commercial DRM provider
                config.onError?.(`${keySystem} requires external license server`);
              }
            }
          });

          // Listen for key status changes
          session.addEventListener('keystatuseschange', () => {
            handleKeyStatusChange(session);
          });

          // Generate the license request
          if (event.initData) {
            await session.generateRequest(event.initDataType, event.initData);
          }
        } catch (err) {
          console.error('Failed to handle encrypted event:', err);
          config.onError?.('Failed to initialize content decryption');
        }
      });

      setEmeState(prev => ({ ...prev, isInitialized: true }));
      console.log(`EME initialized with ${keySystem}`);
      return true;

    } catch (err) {
      console.error('Failed to initialize EME:', err);
      config.onError?.('Failed to initialize content protection');
      setEmeState(prev => ({ ...prev, isInitialized: true }));
      return false;
    }
  }, [generateSessionToken, checkEMESupport, handleClearKeyLicenseRequest, handleKeyStatusChange, config]);

  // Manually trigger license acquisition for unencrypted content with our protection
  const acquireManualLicense = useCallback(async (): Promise<boolean> => {
    if (!user) {
      config.onError?.('User not authenticated');
      return false;
    }

    sessionTokenRef.current = generateSessionToken();

    try {
      const { data, error } = await supabase.functions.invoke('drm-license-server', {
        body: {
          contentId: config.contentId,
          episodeId: config.episodeId,
          action: 'acquire',
          sessionToken: sessionTokenRef.current,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setEmeState(prev => ({ ...prev, hasLicense: true }));
        config.onLicenseAcquired?.();
        return true;
      }

      return false;
    } catch (err) {
      console.error('Failed to acquire manual license:', err);
      config.onError?.('Failed to acquire playback license');
      return false;
    }
  }, [user, config, generateSessionToken]);

  // Close key session and cleanup
  const cleanup = useCallback(async () => {
    if (keySessionRef.current) {
      try {
        await keySessionRef.current.close();
      } catch (e) {
        console.log('Error closing key session:', e);
      }
      keySessionRef.current = null;
    }

    if (sessionTokenRef.current) {
      // Revoke the license on the server
      try {
        await supabase.functions.invoke('drm-license-server', {
          body: {
            contentId: config.contentId,
            action: 'revoke',
            sessionToken: sessionTokenRef.current,
          },
        });
      } catch (e) {
        console.log('Error revoking license:', e);
      }
      sessionTokenRef.current = null;
    }

    mediaKeysRef.current = null;
    setEmeState({
      isSupported: false,
      activeKeySystem: null,
      keyStatus: null,
      hasLicense: false,
      isInitialized: false,
    });
  }, [config.contentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    emeState,
    initializeEME,
    acquireManualLicense,
    cleanup,
    sessionToken: sessionTokenRef.current,
  };
};
