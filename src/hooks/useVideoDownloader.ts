import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteDownload,
  hasDownload,
  saveDownload,
  type DownloadMetadata,
} from "@/services/offlineStorage";
import {
  estimateStorage,
  formatBytes,
  hasSpaceFor,
  isQuotaExceededError,
  requestPersistentStorage,
} from "@/utils/storageQuota";
import { supabase } from "@/integrations/supabase/client";

// Fetch the asset, falling back through the authenticated proxy when the CDN
// rejects the direct request (403 hotlink protection, signed-URL expiry, etc).
async function fetchVideoResilient(
  videoUrl: string,
  signal: AbortSignal,
): Promise<Response> {
  // 1. Try direct fetch first — fastest path for public assets.
  try {
    const direct = await fetch(videoUrl, { signal });
    if (direct.ok) return direct;
    // 401/403 typically mean the CDN requires our signed proxy.
    if (direct.status !== 401 && direct.status !== 403) {
      throw new Error(`HTTP error! status: ${direct.status}`);
    }
    // eslint-disable-next-line no-console
    console.warn("[Downloader] direct fetch denied", direct.status, "— retrying via proxy");
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") throw e;
    // CORS / network — fall through to proxy.
    // eslint-disable-next-line no-console
    console.warn("[Downloader] direct fetch failed, retrying via proxy:", (e as Error).message);
  }

  // 2. Authenticated proxy: download-video edge function.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Sign in required to download this video");
  }
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
  const proxied = await fetch(`${supabaseUrl}/functions/v1/download-video`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ videoUrl }),
  });
  if (!proxied.ok) {
    let msg = `HTTP error! status: ${proxied.status}`;
    try {
      const j = await proxied.clone().json();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    if (proxied.status === 403) msg = "Active subscription required to download";
    throw new Error(msg);
  }
  return proxied;
}


export interface UseVideoDownloaderResult {
  isDownloading: boolean;
  progress: number;
  error: string | null;
  isDownloaded: boolean;
  indeterminate: boolean;
  download: () => Promise<void>;
  cancelDownload: () => void;
  removeDownload: () => Promise<void>;
}

export type DownloadMetadataInput = Partial<DownloadMetadata> & {
  title: string;
};

/**
 * Resilient video download hook.
 *
 * SAFETY: If `isRestricted` is true (DRM / premium / paid), the hook refuses
 * to make any network request — it surfaces a clear error instead.
 */
export function useVideoDownloader(
  contentId: string,
  videoUrl: string,
  metadata: DownloadMetadataInput,
  isRestricted: boolean,
): UseVideoDownloaderResult {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [indeterminate, setIndeterminate] = useState(false);
  const [error, setError] = useState<string | null>(
    isRestricted ? "DRM/Paid content cannot be downloaded" : null,
  );
  const [isDownloaded, setIsDownloaded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Track download state on mount / contentId change.
  useEffect(() => {
    mountedRef.current = true;
    if (!isRestricted) {
      hasDownload(contentId)
        .then((exists) => {
          if (mountedRef.current) setIsDownloaded(exists);
        })
        .catch(() => {
          /* non-fatal */
        });
    }
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [contentId, isRestricted]);

  const cancelDownload = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const download = useCallback(async () => {
    if (isRestricted) {
      // eslint-disable-next-line no-console
      console.error('Blocked download attempt on restricted content');
      setError('This content cannot be downloaded.');
      return;
    }
    if (!videoUrl) {
      setError("No video URL available");
      return;
    }
    if (isDownloading) return;

    setError(null);
    setProgress(0);
    setIndeterminate(false);
    setIsDownloading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Best-effort: ask the browser to persist storage so iOS / Chrome don't
    // evict the download under disk pressure. Safe to call repeatedly.
    void requestPersistentStorage();

    // Pre-flight quota check (best-effort — passes through if unsupported).
    const preflight = await hasSpaceFor(0);
    if (!preflight.ok) {
      setError(
        `Not enough storage. ${formatBytes(preflight.estimate.available)} free of ${formatBytes(preflight.estimate.quota)}.`,
      );
      setIsDownloading(false);
      return;
    }

    try {
      const res = await fetchVideoResilient(videoUrl, controller.signal);

      // Many CDNs (DigitalOcean Spaces, Cloudflare) strip content-length on
      // streaming responses. Fall back to indeterminate progress and let the
      // browser materialize the blob — far more reliable than manual streaming
      // inside a PWA on mobile.
      const contentLength = res.headers.get("content-length");
      if (!contentLength && mountedRef.current) {
        setIndeterminate(true);
        setProgress(50);
      } else if (contentLength) {
        // We know the size — re-check available quota now that we have it.
        const sized = await hasSpaceFor(parseInt(contentLength, 10));
        if (!sized.ok) {
          throw Object.assign(new Error("Not enough storage on this device"), {
            name: "QuotaExceededError",
          });
        }
      }

      const blob = await res.blob();
      // eslint-disable-next-line no-console
      console.log("[Downloader] fetched blob", {
        contentId,
        size: blob.size,
        type: blob.type,
      });

      try {
        await saveDownload(contentId, blob, metadata);
      } catch (writeErr) {
        if (isQuotaExceededError(writeErr)) {
          const est = await estimateStorage();
          throw Object.assign(
            new Error(
              `Storage full. ${formatBytes(est.available)} free of ${formatBytes(est.quota)}. Delete some downloads and try again.`,
            ),
            { name: "QuotaExceededError" },
          );
        }
        throw writeErr;
      }
      // eslint-disable-next-line no-console
      console.log("[Downloader] saved to IndexedDB:", contentId);

      if (mountedRef.current) {
        setProgress(100);
        setIndeterminate(false);
        setIsDownloaded(true);
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === "AbortError") {
        if (mountedRef.current) {
          setError(null);
          setProgress(0);
          setIndeterminate(false);
        }
      } else if (mountedRef.current) {
        setError(err?.message || "Download failed");
      }
    } finally {
      if (mountedRef.current) setIsDownloading(false);
      abortRef.current = null;
    }
  }, [contentId, videoUrl, metadata, isRestricted, isDownloading]);


  const removeDownload = useCallback(async () => {
    await deleteDownload(contentId);
    if (mountedRef.current) {
      setIsDownloaded(false);
      setProgress(0);
      setError(null);
    }
  }, [contentId]);

  return {
    isDownloading,
    progress,
    error,
    isDownloaded,
    indeterminate,
    download,
    cancelDownload,
    removeDownload,
  };
}

export default useVideoDownloader;
