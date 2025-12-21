import { useState, useEffect, useCallback, useRef } from 'react';

interface PreloadState {
  isPreloading: boolean;
  preloadedBytes: number;
  preloadProgress: number;
  error: string | null;
}

interface VideoPreloadCache {
  url: string;
  blob: Blob;
  objectUrl: string;
  cachedAt: number;
  expiresAt: number;
}

// In-memory cache for preloaded videos
const videoCache = new Map<string, VideoPreloadCache>();

// Cache expiry time (30 minutes)
const CACHE_EXPIRY_MS = 30 * 60 * 1000;

// Maximum cache size (500MB)
const MAX_CACHE_SIZE = 500 * 1024 * 1024;

// Clean up expired cache entries
function cleanupCache() {
  const now = Date.now();
  let totalSize = 0;
  const entries: [string, VideoPreloadCache][] = [];
  
  videoCache.forEach((value, key) => {
    if (value.expiresAt < now) {
      URL.revokeObjectURL(value.objectUrl);
      videoCache.delete(key);
    } else {
      entries.push([key, value]);
      totalSize += value.blob.size;
    }
  });
  
  // If still over limit, remove oldest entries
  if (totalSize > MAX_CACHE_SIZE) {
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    for (const [key, value] of entries) {
      if (totalSize <= MAX_CACHE_SIZE) break;
      URL.revokeObjectURL(value.objectUrl);
      videoCache.delete(key);
      totalSize -= value.blob.size;
    }
  }
}

export function useVideoPreloading() {
  const [state, setState] = useState<PreloadState>({
    isPreloading: false,
    preloadedBytes: 0,
    preloadProgress: 0,
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Preload a video URL and cache it
  const preloadVideo = useCallback(async (
    url: string,
    options?: {
      onProgress?: (progress: number) => void;
      priority?: 'high' | 'low';
    }
  ): Promise<string | null> => {
    // Check if already cached
    const cached = videoCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      console.log('[VideoPreload] Using cached video:', url);
      return cached.objectUrl;
    }
    
    // Clean up old cache
    cleanupCache();
    
    // Cancel any existing preload
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setState({
      isPreloading: true,
      preloadedBytes: 0,
      preloadProgress: 0,
      error: null,
    });
    
    try {
      console.log('[VideoPreload] Starting preload:', url);
      
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        // Use low priority for background preloading
        priority: options?.priority || 'low',
      } as RequestInit);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedBytes += value.length;
        
        const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;
        setState(prev => ({
          ...prev,
          preloadedBytes: receivedBytes,
          preloadProgress: progress,
        }));
        
        options?.onProgress?.(progress);
      }
      
      // Create blob from chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      const blob = new Blob([combined], { type: 'video/mp4' });
      const objectUrl = URL.createObjectURL(blob);
      
      // Cache the result
      const now = Date.now();
      videoCache.set(url, {
        url,
        blob,
        objectUrl,
        cachedAt: now,
        expiresAt: now + CACHE_EXPIRY_MS,
      });
      
      setState({
        isPreloading: false,
        preloadedBytes: receivedBytes,
        preloadProgress: 100,
        error: null,
      });
      
      console.log('[VideoPreload] Completed:', url, `(${(receivedBytes / 1024 / 1024).toFixed(2)} MB)`);
      
      return objectUrl;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('[VideoPreload] Aborted:', url);
        return null;
      }
      
      console.error('[VideoPreload] Error:', error);
      setState({
        isPreloading: false,
        preloadedBytes: 0,
        preloadProgress: 0,
        error: (error as Error).message,
      });
      
      return null;
    }
  }, []);
  
  // Cancel ongoing preload
  const cancelPreload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState({
      isPreloading: false,
      preloadedBytes: 0,
      preloadProgress: 0,
      error: null,
    });
  }, []);
  
  // Get cached video URL if available
  const getCachedUrl = useCallback((url: string): string | null => {
    const cached = videoCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.objectUrl;
    }
    return null;
  }, []);
  
  // Check if video is cached
  const isCached = useCallback((url: string): boolean => {
    const cached = videoCache.get(url);
    return cached !== undefined && cached.expiresAt > Date.now();
  }, []);
  
  // Clear specific video from cache
  const clearFromCache = useCallback((url: string) => {
    const cached = videoCache.get(url);
    if (cached) {
      URL.revokeObjectURL(cached.objectUrl);
      videoCache.delete(url);
    }
  }, []);
  
  // Clear entire cache
  const clearCache = useCallback(() => {
    videoCache.forEach((value) => {
      URL.revokeObjectURL(value.objectUrl);
    });
    videoCache.clear();
  }, []);
  
  // Get cache stats
  const getCacheStats = useCallback(() => {
    let totalSize = 0;
    let count = 0;
    
    videoCache.forEach((value) => {
      if (value.expiresAt > Date.now()) {
        totalSize += value.blob.size;
        count++;
      }
    });
    
    return {
      count,
      totalSize,
      formattedSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
    };
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  return {
    ...state,
    preloadVideo,
    cancelPreload,
    getCachedUrl,
    isCached,
    clearFromCache,
    clearCache,
    getCacheStats,
  };
}

// Hook to preload next episode in a series
export function useNextEpisodePreloading(
  currentEpisodeId: string | undefined,
  nextEpisodeUrl: string | undefined
) {
  const { preloadVideo, cancelPreload, getCachedUrl, isCached } = useVideoPreloading();
  const preloadedRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!nextEpisodeUrl || !currentEpisodeId) return;
    
    // Don't preload if already cached
    if (isCached(nextEpisodeUrl)) {
      preloadedRef.current = nextEpisodeUrl;
      return;
    }
    
    // Start preloading after a delay (to not interfere with current playback)
    const timer = setTimeout(() => {
      preloadVideo(nextEpisodeUrl, { priority: 'low' }).then((url) => {
        if (url) {
          preloadedRef.current = nextEpisodeUrl;
        }
      });
    }, 10000); // Start preloading 10 seconds after current episode starts
    
    return () => {
      clearTimeout(timer);
      cancelPreload();
    };
  }, [currentEpisodeId, nextEpisodeUrl, preloadVideo, cancelPreload, isCached]);
  
  return {
    isNextEpisodeCached: nextEpisodeUrl ? isCached(nextEpisodeUrl) : false,
    getNextEpisodeUrl: () => nextEpisodeUrl ? getCachedUrl(nextEpisodeUrl) || nextEpisodeUrl : null,
  };
}
