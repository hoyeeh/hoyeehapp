/**
 * Validates that a video URL is accessible
 * Returns true if the URL returns a successful response
 */
export const validateVideoUrl = async (url: string): Promise<{ valid: boolean; error?: string }> => {
  if (!url || url.trim() === '') {
    return { valid: true }; // Empty URLs are valid (optional field)
  }

  // Basic URL format validation
  try {
    new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Check if URL is accessible using HEAD request
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      // Verify it's a video content type
      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.startsWith('video/') && !contentType.includes('octet-stream')) {
        // Some CDNs return octet-stream for videos, so we allow that
        console.warn('Content type may not be video:', contentType);
      }
      return { valid: true };
    } else if (response.status === 403) {
      // CORS or permission issue - URL might still be valid
      return { valid: true }; // Accept as valid since CORS blocks HEAD requests
    } else {
      return { valid: false, error: `URL returned status ${response.status}` };
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { valid: false, error: 'Request timed out - URL may be inaccessible' };
      }
      // CORS errors are common - treat as potentially valid
      if (error.message.includes('CORS') || error.message.includes('NetworkError')) {
        return { valid: true }; // Accept as valid since we can't verify due to CORS
      }
    }
    return { valid: false, error: 'Could not verify URL accessibility' };
  }
};

/**
 * Converts an old video URL format to the new CDN format
 */
export const migrateVideoUrlToCdn = (url: string): string => {
  if (!url) return url;

  // Already a CDN URL
  if (url.includes('.cdn.digitaloceanspaces.com')) {
    return url;
  }

  // Convert .digitaloceanspaces.com to .cdn.digitaloceanspaces.com
  if (url.includes('.digitaloceanspaces.com') && !url.includes('.cdn.')) {
    return url.replace('.digitaloceanspaces.com', '.cdn.digitaloceanspaces.com');
  }

  // Handle other potential old formats
  // Example: https://bucket.nyc3.digitaloceanspaces.com/path
  // Convert to: https://bucket.nyc3.cdn.digitaloceanspaces.com/path
  const doSpacesRegex = /https:\/\/([^.]+)\.([^.]+)\.digitaloceanspaces\.com/;
  const match = url.match(doSpacesRegex);
  if (match) {
    const [, bucket, region] = match;
    return url.replace(
      `https://${bucket}.${region}.digitaloceanspaces.com`,
      `https://${bucket}.${region}.cdn.digitaloceanspaces.com`
    );
  }

  return url;
};

/**
 * Check if a URL needs migration to CDN format
 */
export const needsCdnMigration = (url: string): boolean => {
  if (!url) return false;
  
  // Is a DigitalOcean Spaces URL but not using CDN
  return url.includes('.digitaloceanspaces.com') && !url.includes('.cdn.digitaloceanspaces.com');
};
