import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface DRMConfig {
  contentId: string;
  episodeId?: string;
  onSecurityViolation?: (type: string, details?: string) => void;
  onLicenseError?: (error: string) => void;
}

interface DRMState {
  isProtected: boolean;
  licenseAcquired: boolean;
  securityLevel: 'high' | 'medium' | 'low';
  lastHeartbeat: Date | null;
  violations: string[];
}

// EME Key System identifiers
const KEY_SYSTEMS = {
  widevine: 'com.widevine.alpha',
  fairplay: 'com.apple.fps.1_0',
  playready: 'com.microsoft.playready',
} as const;

export const useDRMProtection = (config: DRMConfig) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionToken = useRef<string | null>(null);
  
  const [drmState, setDrmState] = useState<DRMState>({
    isProtected: false,
    licenseAcquired: false,
    securityLevel: 'low',
    lastHeartbeat: null,
    violations: [],
  });

  // Generate unique session token
  const generateSessionToken = useCallback(() => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const userId = user?.id || 'anonymous';
    return btoa(`${userId}:${timestamp}:${random}:${config.contentId}`);
  }, [user?.id, config.contentId]);

  // Detect available DRM system
  const detectDRMSupport = useCallback(async (): Promise<string | null> => {
    if (!navigator.requestMediaKeySystemAccess) {
      console.log('EME not supported');
      return null;
    }

    const keySystemConfig = [{
      initDataTypes: ['cenc', 'webm'],
      videoCapabilities: [
        { contentType: 'video/mp4; codecs="avc1.42E01E"' },
        { contentType: 'video/webm; codecs="vp9"' },
      ],
      audioCapabilities: [
        { contentType: 'audio/mp4; codecs="mp4a.40.2"' },
      ],
    }];

    // Try Widevine first (most common)
    try {
      await navigator.requestMediaKeySystemAccess(KEY_SYSTEMS.widevine, keySystemConfig);
      return KEY_SYSTEMS.widevine;
    } catch {}

    // Try FairPlay (Safari)
    try {
      await navigator.requestMediaKeySystemAccess(KEY_SYSTEMS.fairplay, keySystemConfig);
      return KEY_SYSTEMS.fairplay;
    } catch {}

    // Try PlayReady (Edge)
    try {
      await navigator.requestMediaKeySystemAccess(KEY_SYSTEMS.playready, keySystemConfig);
      return KEY_SYSTEMS.playready;
    } catch {}

    return null;
  }, []);

  // Acquire DRM license from server
  const acquireLicense = useCallback(async () => {
    if (!user) {
      config.onLicenseError?.('User not authenticated');
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('drm-license-server', {
        body: {
          contentId: config.contentId,
          episodeId: config.episodeId,
          action: 'acquire',
          sessionToken: sessionToken.current,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setDrmState(prev => ({
          ...prev,
          licenseAcquired: true,
          securityLevel: data.securityLevel || 'medium',
        }));
        return true;
      }

      return false;
    } catch (err) {
      console.error('License acquisition failed:', err);
      config.onLicenseError?.('Failed to acquire playback license');
      return false;
    }
  }, [user, config]);

  // Heartbeat to verify playback integrity
  const sendHeartbeat = useCallback(async () => {
    if (!user || !sessionToken.current) return;

    try {
      const { data, error } = await supabase.functions.invoke('drm-license-server', {
        body: {
          contentId: config.contentId,
          episodeId: config.episodeId,
          action: 'heartbeat',
          sessionToken: sessionToken.current,
        },
      });

      if (error || !data?.valid) {
        config.onSecurityViolation?.('heartbeat_failed', 'Session validation failed');
        return;
      }

      setDrmState(prev => ({
        ...prev,
        lastHeartbeat: new Date(),
      }));
    } catch (err) {
      console.error('Heartbeat failed:', err);
    }
  }, [user, config]);

  // Detect screen recording/sharing
  const detectScreenRecording = useCallback(() => {
    // Check for Screen Capture API usage
    const checkDisplayMedia = () => {
      const originalGetDisplayMedia = navigator.mediaDevices?.getDisplayMedia;
      if (originalGetDisplayMedia) {
        navigator.mediaDevices.getDisplayMedia = async function(...args) {
          config.onSecurityViolation?.('screen_capture', 'Screen capture attempt detected');
          setDrmState(prev => ({
            ...prev,
            violations: [...prev.violations, 'screen_capture'],
          }));
          throw new Error('Screen capture not allowed during video playback');
        };
      }
    };

    // Detect visibility changes (potential screen sharing)
    const handleVisibilityChange = () => {
      if (document.hidden && videoRef.current && !videoRef.current.paused) {
        // Video playing in background - could be recording
        console.log('Video playing in background detected');
      }
    };

    // Detect Picture-in-Picture (could be used to bypass protections)
    const handlePiPChange = () => {
      if (document.pictureInPictureElement) {
        console.log('Picture-in-Picture mode detected');
      }
    };

    checkDisplayMedia();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('enterpictureinpicture', handlePiPChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('enterpictureinpicture', handlePiPChange);
    };
  }, [config]);

  // Prevent right-click context menu
  const preventContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    config.onSecurityViolation?.('context_menu', 'Right-click attempt blocked');
    return false;
  }, [config]);

  // Block keyboard shortcuts
  const blockKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    // Block developer tools shortcuts
    const blockedCombos = [
      { key: 'F12', ctrl: false, shift: false },
      { key: 'I', ctrl: true, shift: true }, // Ctrl+Shift+I
      { key: 'J', ctrl: true, shift: true }, // Ctrl+Shift+J
      { key: 'C', ctrl: true, shift: true }, // Ctrl+Shift+C
      { key: 'U', ctrl: true, shift: false }, // Ctrl+U (view source)
      { key: 'S', ctrl: true, shift: false }, // Ctrl+S (save)
      { key: 'P', ctrl: true, shift: false }, // Ctrl+P (print)
    ];

    for (const combo of blockedCombos) {
      if (
        e.key === combo.key &&
        e.ctrlKey === combo.ctrl &&
        e.shiftKey === combo.shift
      ) {
        e.preventDefault();
        e.stopPropagation();
        config.onSecurityViolation?.('keyboard_shortcut', `Blocked shortcut: ${e.key}`);
        return;
      }
    }

    // Also block Cmd variants for Mac
    if (e.metaKey) {
      const blockedMacCombos = ['s', 'u', 'p', 'i', 'j', 'c'];
      if (blockedMacCombos.includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
        config.onSecurityViolation?.('keyboard_shortcut', `Blocked Mac shortcut: ${e.key}`);
      }
    }
  }, [config]);

  // Detect DevTools opening (deterrent only)
  const detectDevTools = useCallback(() => {
    const threshold = 160;
    let devToolsOpen = false;

    const checkDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      if ((widthThreshold || heightThreshold) && !devToolsOpen) {
        devToolsOpen = true;
        config.onSecurityViolation?.('devtools_open', 'Developer tools detected');
        setDrmState(prev => ({
          ...prev,
          violations: [...prev.violations, 'devtools_open'],
        }));
      } else if (!widthThreshold && !heightThreshold) {
        devToolsOpen = false;
      }
    };

    const interval = setInterval(checkDevTools, 1000);
    return () => clearInterval(interval);
  }, [config]);

  // Setup MutationObserver to detect video element tampering
  const setupAntiTampering = useCallback(() => {
    if (!videoRef.current) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const attrName = mutation.attributeName;
          // Detect attempts to modify src, currentSrc, or other critical attributes
          if (['src', 'currentSrc', 'crossorigin', 'poster'].includes(attrName || '')) {
            config.onSecurityViolation?.('tampering', `Video element modified: ${attrName}`);
          }
        }
      }
    });

    observer.observe(videoRef.current, {
      attributes: true,
      attributeFilter: ['src', 'currentSrc', 'crossorigin', 'poster'],
    });

    return () => observer.disconnect();
  }, [config]);

  // Initialize DRM protection
  useEffect(() => {
    if (isMobile) {
      // Mobile has different protection needs
      setDrmState(prev => ({ ...prev, isProtected: true, securityLevel: 'medium' }));
      return;
    }

    // Generate session token
    sessionToken.current = generateSessionToken();

    // Initialize all protections
    const cleanupScreenRecording = detectScreenRecording();
    const cleanupDevTools = detectDevTools();

    // Start heartbeat
    heartbeatInterval.current = setInterval(sendHeartbeat, 30000); // Every 30 seconds

    // Acquire initial license
    acquireLicense().then(success => {
      if (success) {
        setDrmState(prev => ({ ...prev, isProtected: true }));
      }
    });

    return () => {
      cleanupScreenRecording();
      cleanupDevTools();
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [isMobile, generateSessionToken, detectScreenRecording, detectDevTools, sendHeartbeat, acquireLicense]);

  // Setup event listeners for protection
  useEffect(() => {
    if (isMobile) return;

    const container = containerRef.current;
    const video = videoRef.current;

    if (container) {
      container.addEventListener('contextmenu', preventContextMenu);
    }
    if (video) {
      video.addEventListener('contextmenu', preventContextMenu);
    }

    document.addEventListener('keydown', blockKeyboardShortcuts);

    const cleanupTampering = setupAntiTampering();

    return () => {
      if (container) {
        container.removeEventListener('contextmenu', preventContextMenu);
      }
      if (video) {
        video.removeEventListener('contextmenu', preventContextMenu);
      }
      document.removeEventListener('keydown', blockKeyboardShortcuts);
      cleanupTampering?.();
    };
  }, [isMobile, preventContextMenu, blockKeyboardShortcuts, setupAntiTampering]);

  // Bind refs to actual elements
  const bindVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);

  const bindContainerRef = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
  }, []);

  // Create protected video source (blob URL)
  const createProtectedSource = useCallback(async (originalUrl: string): Promise<string> => {
    try {
      const response = await fetch(originalUrl, {
        credentials: 'include',
        headers: {
          'X-DRM-Session': sessionToken.current || '',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch video');

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('Failed to create protected source:', err);
      return originalUrl; // Fallback to original
    }
  }, []);

  // Revoke license on cleanup
  const revokeLicense = useCallback(async () => {
    if (!sessionToken.current) return;

    try {
      await supabase.functions.invoke('drm-license-server', {
        body: {
          contentId: config.contentId,
          action: 'revoke',
          sessionToken: sessionToken.current,
        },
      });
    } catch (err) {
      console.error('Failed to revoke license:', err);
    }
  }, [config.contentId]);

  return {
    drmState,
    bindVideoRef,
    bindContainerRef,
    createProtectedSource,
    revokeLicense,
    preventContextMenu,
    blockKeyboardShortcuts,
    isProtected: drmState.isProtected && drmState.licenseAcquired,
  };
};
