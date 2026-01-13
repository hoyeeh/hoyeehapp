import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseSecureVideoUrlOptions {
  contentId: string;
  episodeId?: string;
  quality?: string;
  enabled?: boolean;
  refreshBufferMs?: number; // How early to refresh before expiry (default: 5 minutes)
}

interface SecureVideoUrlState {
  signedUrl: string | null;
  isLoading: boolean;
  error: string | null;
  expiresAt: Date | null;
  contentTitle: string | null;
}

// Default refresh buffer: 5 minutes before expiry
const DEFAULT_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Hook to manage secure video URLs with automatic refresh
 * 
 * Features:
 * - Fetches signed URLs from the edge function
 * - Automatically refreshes URLs before they expire
 * - Handles errors gracefully
 */
export function useSecureVideoUrl({
  contentId,
  episodeId,
  quality,
  enabled = true,
  refreshBufferMs = DEFAULT_REFRESH_BUFFER_MS,
}: UseSecureVideoUrlOptions) {
  const [state, setState] = useState<SecureVideoUrlState>({
    signedUrl: null,
    isLoading: false,
    error: null,
    expiresAt: null,
    contentTitle: null,
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchSignedUrl = useCallback(async () => {
    if (!contentId || !enabled) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.functions.invoke('generate-signed-url', {
        body: { contentId, episodeId, quality },
      });

      if (!isMountedRef.current) return;

      if (error) {
        throw new Error(error.message || 'Failed to get secure video URL');
      }

      if (!data?.signedUrl) {
        throw new Error('No signed URL returned');
      }

      const expiresAt = new Date(data.expiresAt);

      setState({
        signedUrl: data.signedUrl,
        isLoading: false,
        error: null,
        expiresAt,
        contentTitle: data.contentTitle,
      });

      // Schedule refresh before expiry
      const timeUntilRefresh = expiresAt.getTime() - Date.now() - refreshBufferMs;
      
      if (timeUntilRefresh > 0) {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        
        refreshTimeoutRef.current = setTimeout(() => {
          console.log('[SecureVideoUrl] Auto-refreshing URL before expiry');
          fetchSignedUrl();
        }, timeUntilRefresh);
      }
    } catch (error) {
      if (!isMountedRef.current) return;

      const errorMessage = error instanceof Error ? error.message : 'Failed to get secure video URL';
      console.error('[SecureVideoUrl] Error:', errorMessage);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [contentId, episodeId, quality, enabled, refreshBufferMs]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    
    if (enabled && contentId) {
      fetchSignedUrl();
    }

    return () => {
      isMountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchSignedUrl, enabled, contentId]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    return fetchSignedUrl();
  }, [fetchSignedUrl]);

  // Check if URL is expired or about to expire
  const isExpired = useCallback(() => {
    if (!state.expiresAt) return true;
    return Date.now() >= state.expiresAt.getTime();
  }, [state.expiresAt]);

  const isExpiringSoon = useCallback(() => {
    if (!state.expiresAt) return true;
    return Date.now() >= state.expiresAt.getTime() - refreshBufferMs;
  }, [state.expiresAt, refreshBufferMs]);

  return {
    ...state,
    refresh,
    isExpired: isExpired(),
    isExpiringSoon: isExpiringSoon(),
  };
}

export default useSecureVideoUrl;
