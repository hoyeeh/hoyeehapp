import { useState, useEffect, useCallback } from "react";
import { Content } from "@/types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "hoyeeh_offline_db";
const DB_VERSION = 1;
const CONTENT_STORE = "downloaded_content";
const VIDEO_STORE = "video_chunks";

interface DownloadedContent {
  id: string;
  content: Content;
  downloadedAt: string;
  totalSize: number;
  episodeId?: string;
  episodeTitle?: string;
}

interface DownloadProgress {
  contentId: string;
  progress: number;
  status: "pending" | "downloading" | "completed" | "error";
}

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for content metadata
      if (!db.objectStoreNames.contains(CONTENT_STORE)) {
        db.createObjectStore(CONTENT_STORE, { keyPath: "id" });
      }

      // Store for video blob chunks
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        const videoStore = db.createObjectStore(VIDEO_STORE, { keyPath: "id" });
        videoStore.createIndex("contentId", "contentId", { unique: false });
      }
    };
  });
};

export const useOfflineDownloads = () => {
  const [downloads, setDownloads] = useState<DownloadedContent[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Load downloaded content list
  const loadDownloads = useCallback(async () => {
    try {
      const db = await initDB();
      const transaction = db.transaction(CONTENT_STORE, "readonly");
      const store = transaction.objectStore(CONTENT_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        setDownloads(request.result || []);
        setIsLoading(false);
      };

      request.onerror = () => {
        console.error("Failed to load downloads");
        setIsLoading(false);
      };
    } catch (error) {
      console.error("Database error:", error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDownloads();
  }, [loadDownloads]);

  // Download content for offline viewing
  const downloadContent = useCallback(
    async (content: Content, episodeId?: string, episodeTitle?: string) => {
      const downloadId = episodeId || content.id;
      const videoUrl = content.videoUrl;

      if (!videoUrl) {
        toast.error("No video URL available for this content");
        return;
      }

      // Check if already downloaded
      if (downloads.find((d) => d.id === downloadId)) {
        toast.info("This content is already downloaded");
        return;
      }

      // Update progress state
      setDownloadProgress((prev) =>
        new Map(prev).set(downloadId, {
          contentId: downloadId,
          progress: 0,
          status: "downloading",
        })
      );

      toast.info(`Starting download: ${episodeTitle || content.title}`);

      try {
        // Get auth token for the request
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        // Use edge function to proxy the download (bypasses CORS)
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-video`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ videoUrl }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Download response error:", errorText);
          throw new Error("Failed to fetch video");
        }

        const contentLength = response.headers.get("content-length");
        const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to read response");

        const chunks: Uint8Array[] = [];
        let receivedLength = 0;

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          // Update progress
          const progress = totalSize ? Math.round((receivedLength / totalSize) * 100) : 0;
          setDownloadProgress((prev) =>
            new Map(prev).set(downloadId, {
              contentId: downloadId,
              progress,
              status: "downloading",
            })
          );
        }

        // Combine chunks into a blob
        const combinedChunks = chunks.map(chunk => chunk.buffer as ArrayBuffer);
        const blob = new Blob(combinedChunks, { type: "video/mp4" });

        // Store in IndexedDB
        const db = await initDB();

        // Store video blob
        const videoTransaction = db.transaction(VIDEO_STORE, "readwrite");
        const videoStore = videoTransaction.objectStore(VIDEO_STORE);
        await new Promise<void>((resolve, reject) => {
          const request = videoStore.put({
            id: downloadId,
            contentId: content.id,
            blob,
            size: blob.size,
          });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        // Store content metadata
        const contentTransaction = db.transaction(CONTENT_STORE, "readwrite");
        const contentStore = contentTransaction.objectStore(CONTENT_STORE);
        const downloadedContent: DownloadedContent = {
          id: downloadId,
          content,
          downloadedAt: new Date().toISOString(),
          totalSize: blob.size,
          episodeId,
          episodeTitle,
        };
        await new Promise<void>((resolve, reject) => {
          const request = contentStore.put(downloadedContent);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        // Update state
        setDownloads((prev) => [...prev, downloadedContent]);
        setDownloadProgress((prev) =>
          new Map(prev).set(downloadId, {
            contentId: downloadId,
            progress: 100,
            status: "completed",
          })
        );

        toast.success(`Downloaded: ${episodeTitle || content.title}`);
      } catch (error) {
        console.error("Download error:", error);
        setDownloadProgress((prev) =>
          new Map(prev).set(downloadId, {
            contentId: downloadId,
            progress: 0,
            status: "error",
          })
        );
        toast.error(`Failed to download: ${episodeTitle || content.title}`);
      }
    },
    [downloads]
  );

  // Remove downloaded content
  const removeDownload = useCallback(async (downloadId: string) => {
    try {
      const db = await initDB();

      // Remove video blob
      const videoTransaction = db.transaction(VIDEO_STORE, "readwrite");
      const videoStore = videoTransaction.objectStore(VIDEO_STORE);
      videoStore.delete(downloadId);

      // Remove content metadata
      const contentTransaction = db.transaction(CONTENT_STORE, "readwrite");
      const contentStore = contentTransaction.objectStore(CONTENT_STORE);
      contentStore.delete(downloadId);

      setDownloads((prev) => prev.filter((d) => d.id !== downloadId));
      setDownloadProgress((prev) => {
        const newMap = new Map(prev);
        newMap.delete(downloadId);
        return newMap;
      });

      toast.success("Download removed");
    } catch (error) {
      console.error("Failed to remove download:", error);
      toast.error("Failed to remove download");
    }
  }, []);

  // Get offline video URL (creates blob URL from IndexedDB)
  const getOfflineVideoUrl = useCallback(async (downloadId: string): Promise<string | null> => {
    try {
      const db = await initDB();
      const transaction = db.transaction(VIDEO_STORE, "readonly");
      const store = transaction.objectStore(VIDEO_STORE);

      return new Promise((resolve, reject) => {
        const request = store.get(downloadId);
        request.onsuccess = () => {
          if (request.result?.blob) {
            const url = URL.createObjectURL(request.result.blob);
            resolve(url);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to get offline video:", error);
      return null;
    }
  }, []);

  // Check if content is downloaded
  const isDownloaded = useCallback(
    (contentId: string, episodeId?: string) => {
      const id = episodeId || contentId;
      return downloads.some((d) => d.id === id);
    },
    [downloads]
  );

  // Get download progress
  const getProgress = useCallback(
    (contentId: string, episodeId?: string) => {
      const id = episodeId || contentId;
      return downloadProgress.get(id);
    },
    [downloadProgress]
  );

  // Calculate total storage used
  const getTotalStorageUsed = useCallback(() => {
    return downloads.reduce((total, d) => total + d.totalSize, 0);
  }, [downloads]);

  // Format bytes to human readable
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return {
    downloads,
    isLoading,
    downloadContent,
    removeDownload,
    getOfflineVideoUrl,
    isDownloaded,
    getProgress,
    getTotalStorageUsed,
    formatBytes,
  };
};
