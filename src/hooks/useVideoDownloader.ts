import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteDownload,
  downloadKey,
  getManifest,
  hasDownload,
  type DownloadMetadata,
} from "@/services/offlineStorage";
import { downloadToDevice, OfflineDownloadError, type OpenRange } from "@/services/offlineDownloadEngine";
import { requestPersistentStorage } from "@/utils/storageQuota";
import { supabase } from "@/integrations/supabase/client";

/**
 * Opens a byte range through the entitlement-checked `download-video` proxy.
 * The server resolves the media file from the content id — the client never
 * sends or stores a media/signed URL.
 */
export function makeProxyOpenRange(contentId: string, episodeId?: string): OpenRange {
  return async (start, signal) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new OfflineDownloadError("Sign in required to download", "AUTH");
    const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "",
    };
    if (start > 0) headers.Range = `bytes=${start}-`;
    return fetch(`${base}/functions/v1/download-video`, {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify({ contentId, episodeId }),
    });
  };
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

export type DownloadMetadataInput = Partial<DownloadMetadata> & { title: string };

/**
 * SAFETY: If `isRestricted` is true (DRM / premium / paid) no request is made.
 * `videoUrl` is only used to decide whether the title has a source at all.
 */
export function useVideoDownloader(
  contentId: string,
  videoUrl: string,
  metadata: DownloadMetadataInput,
  isRestricted: boolean,
): UseVideoDownloaderResult {
  const episodeId = typeof metadata.episodeId === "string" ? metadata.episodeId : undefined;
  const key = downloadKey(contentId, episodeId);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [indeterminate, setIndeterminate] = useState(false);
  const [error, setError] = useState<string | null>(
    isRestricted ? "DRM/Paid content cannot be downloaded" : null,
  );
  const [isDownloaded, setIsDownloaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!isRestricted) {
      hasDownload(key).then((d) => mountedRef.current && setIsDownloaded(d)).catch(() => {});
      getManifest(key).then((m) => {
        if (mountedRef.current && m && m.status === "partial" && m.totalBytes) {
          setProgress((m.receivedBytes / m.totalBytes) * 100);
        }
      }).catch(() => {});
    }
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [key, isRestricted]);

  const cancelDownload = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const download = useCallback(async () => {
    if (isRestricted) {
      setError("This content cannot be downloaded.");
      return;
    }
    if (!videoUrl) {
      setError("No video available");
      return;
    }
    if (isDownloading) return;
    setError(null);
    setIsDownloading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    void requestPersistentStorage();
    try {
      await downloadToDevice({
        contentId,
        episodeId,
        meta: { title: metadata.title, poster: metadata.poster, duration: metadata.duration },
        openRange: makeProxyOpenRange(contentId, episodeId),
        signal: controller.signal,
        onProgress: (got, total) => {
          if (!mountedRef.current) return;
          setIndeterminate(!total);
          setProgress(total ? (got / total) * 100 : 50);
        },
      });
      if (mountedRef.current) {
        setProgress(100);
        setIndeterminate(false);
        setIsDownloaded(true);
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (!mountedRef.current) return;
      if (err?.name === "AbortError") setError(null); // partial bytes kept for resume
      else setError(err?.message || "Download failed");
    } finally {
      if (mountedRef.current) setIsDownloading(false);
      abortRef.current = null;
    }
  }, [contentId, episodeId, videoUrl, metadata.title, metadata.poster, metadata.duration, isRestricted, isDownloading]);

  const removeDownload = useCallback(async () => {
    abortRef.current?.abort();
    await deleteDownload(key);
    if (mountedRef.current) {
      setIsDownloaded(false);
      setProgress(0);
      setError(null);
    }
  }, [key]);

  return { isDownloading, progress, error, isDownloaded, indeterminate, download, cancelDownload, removeDownload };
}
