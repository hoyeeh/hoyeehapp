/**
 * Format seconds into MM:SS or HH:MM:SS format
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse a time string (MM:SS or HH:MM:SS) into seconds
 */
export function parseTime(timeString: string): number {
  const parts = timeString.split(':').map(Number);
  
  if (parts.length === 2) {
    // MM:SS
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // HH:MM:SS
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  return 0;
}

/**
 * Calculate the drift between two time values
 */
export function calculateDrift(currentTime: number, targetTime: number): number {
  return Math.abs(currentTime - targetTime);
}

/**
 * Check if a seek operation should be performed based on drift threshold
 */
export function shouldSeek(
  currentTime: number,
  targetTime: number,
  driftThreshold: number = 1.5
): boolean {
  return calculateDrift(currentTime, targetTime) > driftThreshold;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(currentTime: number, duration: number): number {
  if (!duration || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

/**
 * Calculate buffered percentage from TimeRanges
 */
export function calculateBufferedProgress(
  buffered: TimeRanges,
  currentTime: number,
  duration: number
): number {
  if (!buffered.length || !duration) return 0;

  // Find the buffer range that contains the current time
  for (let i = 0; i < buffered.length; i++) {
    const start = buffered.start(i);
    const end = buffered.end(i);
    if (currentTime >= start && currentTime <= end) {
      return (end / duration) * 100;
    }
  }

  // If no range contains current time, return the end of the last range
  if (buffered.length > 0) {
    return (buffered.end(buffered.length - 1) / duration) * 100;
  }

  return 0;
}

/**
 * Check if video is near the end (within threshold seconds)
 */
export function isNearEnd(
  currentTime: number,
  duration: number,
  thresholdSeconds: number = 30
): boolean {
  if (!duration || duration <= 0) return false;
  return duration - currentTime <= thresholdSeconds && currentTime > 0;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
