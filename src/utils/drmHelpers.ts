/**
 * DRM Helper Utilities
 * Provides security functions for video content protection
 */

// Generate a device fingerprint for license binding
export const generateDeviceFingerprint = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('DRM-Fingerprint', 2, 2);
  }
  
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
    navigator.hardwareConcurrency || 0,
  ];
  
  // Simple hash function
  const hash = components.join('|');
  let hashCode = 0;
  for (let i = 0; i < hash.length; i++) {
    const char = hash.charCodeAt(i);
    hashCode = ((hashCode << 5) - hashCode) + char;
    hashCode = hashCode & hashCode;
  }
  
  return Math.abs(hashCode).toString(36);
};

// Check if running in a virtual machine or emulator (basic detection)
export const detectVirtualEnvironment = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  const vmIndicators = ['vmware', 'virtualbox', 'qemu', 'xen', 'parallels'];
  
  for (const indicator of vmIndicators) {
    if (ua.includes(indicator)) {
      return true;
    }
  }
  
  // Check for suspicious screen dimensions
  if (screen.width === 1024 && screen.height === 768) {
    // Common VM default resolution
    return true;
  }
  
  return false;
};

// Detect browser automation tools
export const detectAutomation = (): boolean => {
  // Check for WebDriver
  if ((navigator as any).webdriver) {
    return true;
  }
  
  // Check for Puppeteer/Playwright signatures
  if ((window as any).__puppeteer_evaluation_script__) {
    return true;
  }
  
  // Check for PhantomJS
  if ((window as any).callPhantom || (window as any)._phantom) {
    return true;
  }
  
  // Check for Selenium
  if ((document as any).__selenium_unwrapped || (document as any).__webdriver_evaluate) {
    return true;
  }
  
  return false;
};

// Obfuscate video URL in memory
export const obfuscateUrl = (url: string): string => {
  // Base64 encode with salt
  const salt = Date.now().toString(36);
  return btoa(salt + '|' + url);
};

// Deobfuscate video URL
export const deobfuscateUrl = (obfuscated: string): string => {
  try {
    const decoded = atob(obfuscated);
    const parts = decoded.split('|');
    return parts.slice(1).join('|');
  } catch {
    return '';
  }
};

// Create invisible watermark data
export const generateWatermark = (userId: string, contentId: string): string => {
  const timestamp = Date.now();
  const data = `${userId}:${contentId}:${timestamp}`;
  return btoa(data);
};

// Parse watermark data
export const parseWatermark = (watermark: string): { userId: string; contentId: string; timestamp: number } | null => {
  try {
    const decoded = atob(watermark);
    const [userId, contentId, timestamp] = decoded.split(':');
    return { userId, contentId, timestamp: parseInt(timestamp, 10) };
  } catch {
    return null;
  }
};

// Check for screen recording software (limited detection)
export const detectScreenRecordingSoftware = (): boolean => {
  // This is a heuristic check - not foolproof
  const windowFeatures = Object.keys(window);
  
  const recordingIndicators = [
    'OBS', 'obs', 'Camtasia', 'ScreenFlow', 'Loom',
    '__REACT_DEVTOOLS_GLOBAL_HOOK__', // Often present with dev tools
  ];
  
  for (const indicator of recordingIndicators) {
    if (windowFeatures.some(f => f.includes(indicator))) {
      return true;
    }
  }
  
  return false;
};

// Validate playback environment
export const validatePlaybackEnvironment = (): { 
  isValid: boolean; 
  issues: string[] 
} => {
  const issues: string[] = [];
  
  if (detectAutomation()) {
    issues.push('Automation detected');
  }
  
  if (detectVirtualEnvironment()) {
    issues.push('Virtual environment detected');
  }
  
  if (detectScreenRecordingSoftware()) {
    issues.push('Screen recording software detected');
  }
  
  // Check for iframe embedding (could bypass protections)
  if (window !== window.top) {
    issues.push('Embedded in iframe');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
};

// CSS classes for protection
export const DRM_PROTECTION_STYLES = {
  container: 'select-none pointer-events-auto',
  video: 'select-none',
  overlay: 'select-none pointer-events-none',
} as const;

// Prevent video download via blob URL manipulation
export const createSecureVideoElement = (container: HTMLElement): HTMLVideoElement => {
  const video = document.createElement('video');
  
  // Disable right-click
  video.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });
  
  // Prevent drag
  video.addEventListener('dragstart', (e) => {
    e.preventDefault();
    return false;
  });
  
  // Apply security styles
  video.style.userSelect = 'none';
  video.style.webkitUserSelect = 'none';
  video.setAttribute('controlslist', 'nodownload noplaybackrate');
  video.setAttribute('disablepictureinpicture', 'true');
  
  container.appendChild(video);
  return video;
};

// Generate secure playback token
export const generatePlaybackToken = (
  userId: string,
  contentId: string,
  expiresIn: number = 3600
): string => {
  const payload = {
    uid: userId,
    cid: contentId,
    exp: Date.now() + (expiresIn * 1000),
    nonce: Math.random().toString(36).substring(2),
  };
  
  return btoa(JSON.stringify(payload));
};

// Validate playback token
export const validatePlaybackToken = (token: string): { 
  valid: boolean; 
  expired: boolean; 
  userId?: string; 
  contentId?: string 
} => {
  try {
    const payload = JSON.parse(atob(token));
    const expired = payload.exp < Date.now();
    
    return {
      valid: !expired,
      expired,
      userId: payload.uid,
      contentId: payload.cid,
    };
  } catch {
    return { valid: false, expired: false };
  }
};

// Detect if console is open (deterrent)
export const isConsoleOpen = (): boolean => {
  const threshold = 160;
  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
  const heightThreshold = window.outerHeight - window.innerHeight > threshold;
  return widthThreshold || heightThreshold;
};

// Anti-debugging measure
export const setupAntiDebugging = (onDebugDetected: () => void): () => void => {
  let debuggerDetected = false;
  
  const checkDebugger = () => {
    const start = performance.now();
    // debugger statement will pause if devtools is open
    // eslint-disable-next-line no-debugger
    debugger;
    const end = performance.now();
    
    // If execution took more than 100ms, debugger was likely active
    if (end - start > 100 && !debuggerDetected) {
      debuggerDetected = true;
      onDebugDetected();
    }
  };
  
  // Check periodically
  const interval = setInterval(checkDebugger, 5000);
  
  return () => clearInterval(interval);
};
