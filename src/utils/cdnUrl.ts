/**
 * Converts a DigitalOcean Spaces origin URL to a CDN URL
 * Origin: bucket.region.digitaloceanspaces.com
 * CDN: bucket.region.cdn.digitaloceanspaces.com
 */
export const toCdnUrl = (originUrl: string): string => {
  if (!originUrl) return originUrl;
  
  // Already a CDN URL
  if (originUrl.includes('.cdn.digitaloceanspaces.com')) {
    return originUrl;
  }
  
  // Convert origin to CDN URL
  return originUrl.replace('.digitaloceanspaces.com', '.cdn.digitaloceanspaces.com');
};

/**
 * Converts a CDN URL back to origin URL (for admin/debugging purposes)
 */
export const toOriginUrl = (cdnUrl: string): string => {
  if (!cdnUrl) return cdnUrl;
  return cdnUrl.replace('.cdn.digitaloceanspaces.com', '.digitaloceanspaces.com');
};
