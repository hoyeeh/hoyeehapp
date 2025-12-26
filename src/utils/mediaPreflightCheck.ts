/**
 * Media Preflight Check Utility
 * Validates video URLs before attempting playback
 */

export interface PreflightResult {
  success: boolean;
  contentType: string | null;
  supportsRange: boolean;
  corsEnabled: boolean;
  fileSize: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  warnings: string[];
}

const SUPPORTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'application/vnd.apple.mpegurl', // HLS
  'application/x-mpegurl',
  'audio/mpegurl',
];

const SUPPORTED_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.m3u8', '.mov'];

export async function performMediaPreflightCheck(url: string): Promise<PreflightResult> {
  const result: PreflightResult = {
    success: false,
    contentType: null,
    supportsRange: false,
    corsEnabled: false,
    fileSize: null,
    errorCode: null,
    errorMessage: null,
    warnings: [],
  };

  if (!url) {
    result.errorCode = 'NO_URL';
    result.errorMessage = 'No video URL provided';
    return result;
  }

  // Check file extension first
  const urlLower = url.toLowerCase();
  const hasValidExtension = SUPPORTED_EXTENSIONS.some(ext => urlLower.includes(ext));
  
  if (!hasValidExtension) {
    result.warnings.push('URL does not have a recognized video file extension');
  }

  try {
    // Use HEAD request first to check headers without downloading content
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    
    try {
      response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'cors',
      });
    } catch (headError) {
      // HEAD might not be allowed, try GET with Range header for minimal data
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { 'Range': 'bytes=0-0' },
          signal: controller.signal,
          mode: 'cors',
        });
      } catch (getError) {
        clearTimeout(timeout);
        throw getError;
      }
    }

    clearTimeout(timeout);

    // Check CORS
    result.corsEnabled = true; // If we got here, CORS is working

    // Check status code
    if (!response.ok && response.status !== 206) {
      result.errorCode = 'HTTP_ERROR';
      result.errorMessage = `Server returned status ${response.status}`;
      return result;
    }

    // Parse content type
    const contentType = response.headers.get('content-type');
    result.contentType = contentType;

    if (contentType) {
      const baseType = contentType.split(';')[0].trim().toLowerCase();
      
      if (!SUPPORTED_VIDEO_TYPES.includes(baseType) && !baseType.startsWith('video/')) {
        result.errorCode = 'UNSUPPORTED_FORMAT';
        result.errorMessage = `Video format "${baseType}" may not be supported on this device`;
        result.warnings.push(`Content-Type: ${contentType}`);
        // Don't fail - some servers misconfigure content-type
      }
    } else {
      result.warnings.push('Server did not provide Content-Type header');
    }

    // Check Range support (important for seeking)
    const acceptRanges = response.headers.get('accept-ranges');
    result.supportsRange = acceptRanges === 'bytes' || response.status === 206;
    
    if (!result.supportsRange) {
      result.warnings.push('Server may not support seeking (no Range support)');
    }

    // Get file size
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    
    if (contentLength) {
      result.fileSize = parseInt(contentLength, 10);
    } else if (contentRange) {
      // Parse "bytes 0-0/12345678"
      const match = contentRange.match(/\/(\d+)/);
      if (match) {
        result.fileSize = parseInt(match[1], 10);
      }
    }

    result.success = true;
    return result;

  } catch (error: any) {
    if (error.name === 'AbortError') {
      result.errorCode = 'TIMEOUT';
      result.errorMessage = 'Connection timed out while checking video';
    } else if (error.message?.includes('CORS') || error.message?.includes('cross-origin')) {
      result.errorCode = 'CORS_ERROR';
      result.errorMessage = 'Video server does not allow cross-origin playback';
      result.corsEnabled = false;
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      result.errorCode = 'NETWORK_ERROR';
      result.errorMessage = 'Network error while checking video availability';
    } else {
      result.errorCode = 'UNKNOWN_ERROR';
      result.errorMessage = error.message || 'Unknown error occurred';
    }
    
    return result;
  }
}

/**
 * Get user-friendly error message for TV display
 */
export function getPreflightErrorDisplay(result: PreflightResult): {
  title: string;
  details: string;
  canRetry: boolean;
} {
  switch (result.errorCode) {
    case 'NO_URL':
      return {
        title: 'No Video',
        details: 'No video URL was provided. Please try again.',
        canRetry: false,
      };
    
    case 'UNSUPPORTED_FORMAT':
      return {
        title: 'Format Not Supported',
        details: `This video format (${result.contentType || 'unknown'}) may not be supported on this TV. Try an MP4 or HLS stream.`,
        canRetry: false,
      };
    
    case 'CORS_ERROR':
      return {
        title: 'Access Denied',
        details: 'The video server does not allow playback from this device. Please contact support.',
        canRetry: false,
      };
    
    case 'TIMEOUT':
      return {
        title: 'Connection Slow',
        details: 'Could not reach the video server. Please check your internet connection.',
        canRetry: true,
      };
    
    case 'NETWORK_ERROR':
      return {
        title: 'Network Error',
        details: 'Could not connect to the video server. Please check your connection.',
        canRetry: true,
      };
    
    case 'HTTP_ERROR':
      return {
        title: 'Video Unavailable',
        details: result.errorMessage || 'The video could not be loaded from the server.',
        canRetry: true,
      };
    
    default:
      return {
        title: 'Error Loading Video',
        details: result.errorMessage || 'An unknown error occurred.',
        canRetry: true,
      };
  }
}

/**
 * Detect best video format for current device
 */
export function detectBestVideoFormat(): {
  supportsHLS: boolean;
  supportsNativeHLS: boolean;
  supportsMSE: boolean;
  preferredFormat: 'hls' | 'mp4';
} {
  const video = document.createElement('video');
  
  // Check for HLS.js support (Media Source Extensions)
  const supportsMSE = 'MediaSource' in window && 
    typeof MediaSource.isTypeSupported === 'function' &&
    MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');

  // Check for native HLS (Safari, iOS)
  const supportsNativeHLS = video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
    video.canPlayType('application/x-mpegurl') !== '';

  const supportsHLS = supportsMSE || supportsNativeHLS;
  
  // Prefer HLS for adaptive streaming, fall back to MP4
  const preferredFormat = supportsHLS ? 'hls' : 'mp4';

  return {
    supportsHLS,
    supportsNativeHLS,
    supportsMSE,
    preferredFormat,
  };
}

/**
 * Get HLS variant URL if available, otherwise return original
 */
export function getAdaptiveStreamUrl(
  mp4Url: string,
  hlsManifestUrl?: string | null
): { url: string; isHLS: boolean } {
  const { supportsHLS } = detectBestVideoFormat();
  
  // If HLS manifest is available and device supports it, use HLS
  if (hlsManifestUrl && supportsHLS) {
    return { url: hlsManifestUrl, isHLS: true };
  }
  
  // Try to derive HLS URL from MP4 URL (common CDN pattern)
  if (supportsHLS && mp4Url) {
    // Check if there's a parallel .m3u8 file
    const hlsUrl = mp4Url.replace(/\.(mp4|mov|webm)$/i, '/master.m3u8');
    if (hlsUrl !== mp4Url) {
      // We could do a HEAD request here to check if it exists
      // For now, just return MP4 as fallback
    }
  }
  
  return { url: mp4Url, isHLS: false };
}
