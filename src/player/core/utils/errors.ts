// Standardized error codes for the Hoyeeh Player Core
export const PlayerErrorCode = {
  MEDIA_ABORTED: 'MEDIA_ABORTED',
  MEDIA_NETWORK: 'MEDIA_NETWORK',
  MEDIA_DECODE: 'MEDIA_DECODE',
  MEDIA_FORMAT: 'MEDIA_FORMAT',
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
} as const;

export type PlayerErrorCodeType = typeof PlayerErrorCode[keyof typeof PlayerErrorCode];

export interface PlayerError {
  code: PlayerErrorCodeType;
  message: string;
  originalError?: MediaError | Error | null;
}

/**
 * Map a native MediaError to a standardized PlayerError
 */
export function mapMediaError(error: MediaError | null): PlayerError {
  if (!error) {
    return {
      code: PlayerErrorCode.UNKNOWN,
      message: 'Unknown video error',
    };
  }

  switch (error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return {
        code: PlayerErrorCode.MEDIA_ABORTED,
        message: 'Video playback was aborted',
        originalError: error,
      };
    case MediaError.MEDIA_ERR_NETWORK:
      return {
        code: PlayerErrorCode.MEDIA_NETWORK,
        message: 'Network error - check your connection',
        originalError: error,
      };
    case MediaError.MEDIA_ERR_DECODE:
      return {
        code: PlayerErrorCode.MEDIA_DECODE,
        message: 'Video format not supported or file corrupted',
        originalError: error,
      };
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return {
        code: PlayerErrorCode.MEDIA_FORMAT,
        message: 'Video source not found or format not supported',
        originalError: error,
      };
    default:
      return {
        code: PlayerErrorCode.UNKNOWN,
        message: error.message || 'Unknown video error',
        originalError: error,
      };
  }
}

/**
 * Create a PlayerError from an error message
 */
export function createPlayerError(
  code: PlayerErrorCodeType,
  message: string,
  originalError?: Error
): PlayerError {
  return {
    code,
    message,
    originalError,
  };
}
