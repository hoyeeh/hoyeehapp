import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteDownload,
  hasDownload,
  saveDownload,
  type DownloadMetadata,
} from "@/services/offlineStorage";

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

    try {
      const res = await fetch(videoUrl, { signal: controller.signal });
      if (!res.ok) throw new Error("Network error");

      const totalHeader = res.headers.get("content-length");
      const total = totalHeader ? Number(totalHeader) : 0;
      const canStream =
        !!res.body && typeof (res.body as ReadableStream).getReader === "function";

      let blob: Blob;

      if (canStream && total > 0) {
        // Determinate progress path.
        const reader = (res.body as ReadableStream<Uint8Array>).getReader();
        const chunks: Uint8Array[] = [];
        let loaded = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.length;
            if (mountedRef.current) {
              setProgress(Math.min(99, Math.round((loaded / total) * 100)));
            }
          }
        }
        blob = new Blob(chunks as BlobPart[], {
          type: res.headers.get("content-type") || "video/mp4",
        });
      } else {
        // Indeterminate path — avoid buffering chunks ourselves on mobile when
        // content-length is unknown; let the browser materialize the blob.
        if (mountedRef.current) setIndeterminate(true);
        blob = await res.blob();
      }

      await saveDownload(contentId, blob, metadata);

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
