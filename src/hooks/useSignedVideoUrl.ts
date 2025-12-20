import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignedUrlResponse {
  signedUrl: string;
  expiresAt: string;
  contentTitle?: string;
}

interface UseSignedVideoUrlReturn {
  getSignedUrl: (contentId: string, episodeId?: string, quality?: string) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
  cachedUrl: string | null;
  expiresAt: Date | null;
}

// Cache for signed URLs to avoid unnecessary requests
const urlCache = new Map<string, { url: string; expiresAt: Date }>();

// Get URL from cache if still valid (with 5 minute buffer)
const getCachedUrl = (cacheKey: string): string | null => {
  const cached = urlCache.get(cacheKey);
  if (!cached) return null;
  
  // Check if URL expires in more than 5 minutes
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  if (cached.expiresAt.getTime() - Date.now() > bufferTime) {
    return cached.url;
  }
  
  // URL is expired or about to expire
  urlCache.delete(cacheKey);
  return null;
};

export const useSignedVideoUrl = (): UseSignedVideoUrlReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const getSignedUrl = useCallback(async (
    contentId: string,
    episodeId?: string,
    quality?: string
  ): Promise<string | null> => {
    const cacheKey = `${contentId}:${episodeId || 'main'}:${quality || 'default'}`;
    
    // Check cache first
    const cached = getCachedUrl(cacheKey);
    if (cached) {
      console.log('Using cached signed URL');
      setCachedUrl(cached);
      return cached;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<SignedUrlResponse>(
        'generate-signed-url',
        {
          body: { contentId, episodeId, quality },
        }
      );

      if (invokeError) {
        console.error('Error invoking generate-signed-url:', invokeError);
        setError(invokeError.message || 'Failed to generate signed URL');
        return null;
      }

      if (!data?.signedUrl) {
        setError('No signed URL returned');
        return null;
      }

      // Cache the URL
      const expiry = new Date(data.expiresAt);
      urlCache.set(cacheKey, { url: data.signedUrl, expiresAt: expiry });
      
      setCachedUrl(data.signedUrl);
      setExpiresAt(expiry);
      
      console.log(`Signed URL generated, expires at ${data.expiresAt}`);
      return data.signedUrl;

    } catch (err) {
      console.error('Error getting signed URL:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    getSignedUrl,
    isLoading,
    error,
    cachedUrl,
    expiresAt,
  };
};

// Utility to clear URL cache (e.g., on logout)
export const clearSignedUrlCache = (): void => {
  urlCache.clear();
};
