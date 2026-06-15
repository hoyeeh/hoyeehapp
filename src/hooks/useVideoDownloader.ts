import { useCallback, useEffect, useRef, useState } from "react";
import { deleteVideo, hasVideo, saveVideo } from "@/services/offlineVideoStorage";

export interface VideoDownloaderArgs {
  contentId: string;
  videoUrl: string;
  metadata: { title: string; poster: string; duration: number };
  isPremium?: boolean;
  requiresDrm?: boolean;
  isPaid?: boolean;
}

export interface VideoDownloaderState {
  isDownloading: boolean;
  progress: number;
  error: string | null;
  isDownloaded: boolean;
  download: () => Promise<void>;
  cancelDownload: () => void;
  removeDownload: () => Promise<void>;
}

/**
 * Hook to download a non-DRM video to local IndexedDB storage.
 * SAFETY: Refuses to run for premium / DRM / paid content.
 */
export function useVideoDownloader({
  contentId,
  videoUrl,
  metadata,
  isPremium,
  requiresDrm,
  isPaid,
}: VideoDownloaderArgs): VideoDownloaderState {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    hasVideo(contentId).then((exists) => {
      if (mountedRef.current) setIsDownloaded(exists);
    }).catch(() => {});
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [contentId]);

  const download = useCallback(async () => {
    if (isPremium || requiresDrm || isPaid) {
      setError("Downloads are not available for premium or protected content.");
      return;
    }
    if (!videoUrl) {
      setError("No video source available to download.");
      return;
    }
    setError(null);
    setProgress(0);
    setIsDownloading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(videoUrl, { signal: controller.signal });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);

      const total = Number(res.headers.get("content-length")) || 0;
      let received = 0;
      const chunks: Uint8Array[] = [];

      if (res.body && typeof res.body.getReader === "function") {
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (total > 0 && mountedRef.current) {
              setProgress(Math.min(99, Math.round((received / total) * 100)));
            }
          }
        }
      } else {
        // Fallback: no streaming support
        const buf = await res.arrayBuffer();
        chunks.push(new Uint8Array(buf));
        received = buf.byteLength;
      }

      const blob = new Blob(chunks as BlobPart[], {
        type: res.headers.get("content-type") || "video/mp4",
      });

      await saveVideo(contentId, blob, metadata);

      if (mountedRef.current) {
        setProgress(100);
        setIsDownloaded(true);
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name === "AbortError") {
        if (mountedRef.current) setError(null);
      } else if (mountedRef.current) {
        setError(err?.message || "Download failed");
      }
    } finally {
      if (mountedRef.current) setIsDownloading(false);
      abortRef.current = null;
    }
  }, [contentId, videoUrl, metadata, isPremium, requiresDrm, isPaid]);

  const cancelDownload = useCallback(() => {
    abortRef.current?.abort();
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
