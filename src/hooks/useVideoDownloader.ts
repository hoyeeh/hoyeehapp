import { useCallback, useEffect, useRef, useState } from "react";
import { deleteVideo, hasVideo, saveVideo } from "@/services/offlineVideoStorage";

/**
 * Return shape of the useVideoDownloader hook.
 */
export interface UseVideoDownloaderResult {
  isDownloading: boolean;
  progress: number;
  error: string | null;
  isDownloaded: boolean;
  download: () => Promise<void>;
  cancelDownload: () => void;
  removeDownload: () => Promise<void>;
}

export interface VideoDownloadMetadata {
  title: string;
  poster: string;
  duration: number;
}

/**
 * Hook to download a non-DRM video into IndexedDB via offlineVideoStorage.
 *
 * SAFETY: If `isPremiumOrDrm` is true, the hook refuses to make any network
 * request and surfaces a clear error message instead.
 *
 * @param contentId       Stable id used as the storage key.
 * @param videoUrl        Direct URL to a downloadable (non-DRM) asset.
 * @param metadata        Title / poster / duration kept alongside the blob.
 * @param isPremiumOrDrm  Hard gate — true blocks all download attempts.
 */
export function useVideoDownloader(
  contentId: string,
  videoUrl: string,
  metadata: VideoDownloadMetadata,
  isPremiumOrDrm: boolean,
): UseVideoDownloaderResult {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Check storage on mount / when contentId changes.
  useEffect(() => {
    mountedRef.current = true;
    hasVideo(contentId)
      .then((exists) => {
        if (mountedRef.current) setIsDownloaded(exists);
      })
      .catch(() => {
        /* non-fatal — assume not downloaded */
      });

    return () => {
      mountedRef.current = false;
      // Abort any in-flight download on unmount to free memory / bandwidth.
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [contentId]);

  const download = useCallback(async () => {
    // 1. Hard DRM / premium safety gate.
    if (isPremiumOrDrm) {
      setError("DRM content cannot be downloaded");
      return;
    }
    if (!videoUrl) {
      setError("No video source available to download.");
      return;
    }
    if (isDownloading) return;

    setError(null);
    setProgress(0);
    setIsDownloading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(videoUrl, { signal: controller.signal });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);

      const totalHeader = res.headers.get("content-length");
      const total = totalHeader ? Number(totalHeader) : 0;

      const chunks: Uint8Array[] = [];
      let loaded = 0;

      if (res.body && typeof res.body.getReader === "function") {
        // 2. Stream the response so we can report real progress.
        const reader = res.body.getReader();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.length;
            if (total > 0 && mountedRef.current) {
              setProgress(Math.min(99, Math.round((loaded / total) * 100)));
            }
          }
        }
      } else {
        // Fallback for environments without ReadableStream support.
        const buf = await res.arrayBuffer();
        chunks.push(new Uint8Array(buf));
        loaded = buf.byteLength;
      }

      const blob = new Blob(chunks as BlobPart[], {
        type: res.headers.get("content-type") || "video/mp4",
      });

      // 3. Persist to IndexedDB via the isolated storage service.
      await saveVideo(contentId, blob, metadata);

      if (mountedRef.current) {
        setProgress(100);
        setIsDownloaded(true);
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === "AbortError") {
        // User-initiated cancel — clear any prior error, keep state clean.
        if (mountedRef.current) {
          setError(null);
          setProgress(0);
        }
      } else if (mountedRef.current) {
        setError(err?.message || "Download failed. Please try again.");
      }
    } finally {
      if (mountedRef.current) setIsDownloading(false);
      abortRef.current = null;
    }
  }, [contentId, videoUrl, metadata, isPremiumOrDrm, isDownloading]);

  const cancelDownload = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const removeDownload = useCallback(async () => {
    await deleteVideo(contentId);
    if (mountedRef.current) {
      setIsDownloaded(false);
      setProgress(0);
    }
  }, [contentId]);

  return {
    isDownloading,
    progress,
    error,
    isDownloaded,
    download,
    cancelDownload,
    removeDownload,
  };
}

export default useVideoDownloader;
