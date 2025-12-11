import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  initDeviceKey,
  encryptSegment,
  decryptSegment,
  saveSegment,
  getSegment,
  saveMetadata,
  getMetadata,
  listDownloads,
  saveLicense,
  getLicense,
  deleteDownload as deleteFromStorage,
  clearAllDownloads,
  deleteDeviceKey,
  getStorageUsed,
  isDownloadComplete,
  isLicenseValid,
  getDownloadId,
  formatBytes,
  type DownloadMetadata,
  type DownloadLicense,
} from '@/lib/downloadStorage';
import { Content } from '@/types';

const STORAGE_LIMIT = 10 * 1024 * 1024 * 1024; // 10 GB
const DEVICE_ID_KEY = 'hoyeeh-device-id';

interface DownloadProgress {
  contentId: string;
  episodeId?: string;
  progress: number;
  downloadedSize: number;
  totalSize: number;
  status: DownloadMetadata['status'];
  speed?: number; // bytes per second
  eta?: number; // estimated time remaining in seconds
}

// Generate or get device ID
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function useDownloadManager() {
  const { user } = useAuth();
  const [downloads, setDownloads] = useState<DownloadMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageUsed, setStorageUsed] = useState(0);
  const [activeDownloads, setActiveDownloads] = useState<Map<string, AbortController>>(new Map());
  const deviceKeyRef = useRef<CryptoKey | null>(null);

  // Load downloads on mount
  useEffect(() => {
    loadDownloads();
    initializeDeviceKey();
  }, []);

  // Cleanup expired downloads on mount
  useEffect(() => {
    cleanupExpiredDownloads();
  }, []);

  const initializeDeviceKey = async () => {
    try {
      deviceKeyRef.current = await initDeviceKey();
    } catch (error) {
      console.error('Failed to initialize device key:', error);
    }
  };

  const loadDownloads = async () => {
    try {
      setIsLoading(true);
      const downloadList = await listDownloads();
      setDownloads(downloadList);
      const used = await getStorageUsed();
      setStorageUsed(used);
    } catch (error) {
      console.error('Failed to load downloads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupExpiredDownloads = async () => {
    const downloadList = await listDownloads();
    let cleaned = 0;
    for (const download of downloadList) {
      const license = await getLicense(download.id);
      if (license && license.expiresAt < Date.now()) {
        await deleteFromStorage(download.id);
        await saveMetadata({ ...download, status: 'expired' });
        cleaned++;
      }
    }
    if (cleaned > 0) {
      await loadDownloads();
    }
    return cleaned;
  };

  // Auto-cleanup to free space when storage limit is reached
  const autoCleanupForSpace = async (requiredSpace: number = 0): Promise<boolean> => {
    const downloadList = await listDownloads();
    let currentStorage = await getStorageUsed();
    const targetStorage = STORAGE_LIMIT - requiredSpace;

    if (currentStorage <= targetStorage) {
      return true; // Already have enough space
    }

    // Step 1: Remove expired downloads first
    const expiredCleaned = await cleanupExpiredDownloads();
    if (expiredCleaned > 0) {
      currentStorage = await getStorageUsed();
      if (currentStorage <= targetStorage) {
        toast.info(`Cleaned up ${expiredCleaned} expired download(s) to free space`);
        return true;
      }
    }

    // Step 2: Get completed downloads sorted by last watched (oldest first), then by creation date
    const completedDownloads = downloadList
      .filter(d => d.status === 'completed')
      .sort((a, b) => {
        // Prioritize removing downloads that were never watched
        const aWatched = a.lastWatchedPosition ? a.updatedAt : 0;
        const bWatched = b.lastWatchedPosition ? b.updatedAt : 0;
        if (aWatched !== bWatched) return aWatched - bWatched;
        // Then by creation date (oldest first)
        return a.createdAt - b.createdAt;
      });

    // Step 3: Remove oldest downloads until we have enough space
    let removedCount = 0;
    for (const download of completedDownloads) {
      if (currentStorage <= targetStorage) break;

      await deleteFromStorage(download.id);
      currentStorage -= download.downloadedSize;
      removedCount++;
    }

    if (removedCount > 0) {
      await loadDownloads();
      toast.info(`Removed ${removedCount} old download(s) to free space`);
    }

    currentStorage = await getStorageUsed();
    return currentStorage <= targetStorage;
  };

  const startDownload = useCallback(async (
    content: Content,
    episodeId?: string,
    episodeTitle?: string,
    preferredQuality: string = '720p'
  ): Promise<void> => {
    if (!user) {
      toast.error('Please log in to download content');
      return;
    }

    const downloadId = getDownloadId(content.id, episodeId);
    
    // Check if already downloading
    if (activeDownloads.has(downloadId)) {
      toast.info('Download already in progress');
      return;
    }

    // Estimate required space based on quality
    const estimatedSize = preferredQuality === '1080p' 
      ? 2 * 1024 * 1024 * 1024 // 2GB
      : preferredQuality === '720p'
      ? 1024 * 1024 * 1024 // 1GB
      : 500 * 1024 * 1024; // 500MB

    // Check storage limit and try auto-cleanup
    const currentStorage = await getStorageUsed();
    if (currentStorage + estimatedSize >= STORAGE_LIMIT) {
      const hasSpace = await autoCleanupForSpace(estimatedSize);
      if (!hasSpace) {
        toast.error('Storage limit reached. Please manually delete some downloads.');
        return;
      }
    }

    // Check if already downloaded
    const existingMetadata = await getMetadata(downloadId);
    if (existingMetadata?.status === 'completed') {
      toast.info('Content already downloaded');
      return;
    }

    const deviceId = getDeviceId();

    try {
      // Request download manifest from backend
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please log in to download content');
        return;
      }

      toast.info(`Starting ${preferredQuality} download: ${episodeTitle || content.title}`);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            contentId: content.id,
            episodeId,
            deviceId,
            preferredQuality,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === 'NO_SUBSCRIPTION') {
          toast.error('Active subscription required for downloads');
        } else if (errorData.code === 'LIMIT_REACHED') {
          toast.error('Download limit reached (25 items)');
        } else {
          toast.error(errorData.error || 'Failed to start download');
        }
        return;
      }

      const { manifest } = await response.json();

      // Initialize device key if not ready
      if (!deviceKeyRef.current) {
        deviceKeyRef.current = await initDeviceKey();
      }

      // Create initial metadata
      const metadata: DownloadMetadata = {
        id: downloadId,
        contentId: content.id,
        episodeId,
        title: content.title,
        episodeTitle,
        thumbnailUrl: content.thumbnailUrl || undefined,
        duration: manifest.duration,
        quality: manifest.quality,
        totalSize: manifest.estimatedSize,
        downloadedSize: 0,
        totalSegments: 1, // We download as a single file
        downloadedSegments: 0,
        status: 'downloading',
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveMetadata(metadata);
      await loadDownloads();

      // Save license
      const license: DownloadLicense = {
        id: downloadId,
        contentId: content.id,
        episodeId,
        expiresAt: manifest.license.expiresAt,
        canPlayOffline: manifest.license.canPlayOffline,
        encryptedContentKey: manifest.license.encryptedContentKey,
        lastVerified: Date.now(),
      };
      await saveLicense(license);

      // Create abort controller for this download
      const abortController = new AbortController();
      setActiveDownloads(prev => new Map(prev).set(downloadId, abortController));

      // Start downloading the video
      await downloadVideo(
        manifest.videoUrl,
        downloadId,
        metadata,
        deviceKeyRef.current,
        abortController.signal
      );

    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed. Please try again.');
      
      // Update status to failed
      const metadata = await getMetadata(downloadId);
      if (metadata) {
        await saveMetadata({ ...metadata, status: 'failed', updatedAt: Date.now() });
        await loadDownloads();
      }
    }
  }, [user, activeDownloads]);

  const downloadVideo = async (
    videoUrl: string,
    downloadId: string,
    metadata: DownloadMetadata,
    deviceKey: CryptoKey,
    signal: AbortSignal
  ) => {
    try {
      // Use edge function to proxy the download
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ videoUrl }),
          signal,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch video');
      }

      const contentLength = response.headers.get('content-length');
      const totalSize = contentLength ? parseInt(contentLength, 10) : metadata.totalSize;

      // Read as stream for progress tracking
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const chunks: Uint8Array[] = [];
      let downloadedSize = 0;
      const startedAt = Date.now();
      let lastUpdateTime = startedAt;
      let lastDownloadedSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        if (signal.aborted) {
          reader.cancel();
          throw new Error('Download cancelled');
        }

        chunks.push(value);
        downloadedSize += value.length;

        const now = Date.now();
        const timeSinceStart = (now - startedAt) / 1000; // seconds
        const timeSinceLastUpdate = (now - lastUpdateTime) / 1000;

        // Calculate speed (bytes per second) - use rolling average
        const overallSpeed = timeSinceStart > 0 ? downloadedSize / timeSinceStart : 0;
        const recentSpeed = timeSinceLastUpdate > 0 ? (downloadedSize - lastDownloadedSize) / timeSinceLastUpdate : overallSpeed;
        const speed = Math.round((overallSpeed + recentSpeed) / 2); // Average of overall and recent

        // Calculate ETA
        const remainingBytes = totalSize - downloadedSize;
        const eta = speed > 0 ? Math.round(remainingBytes / speed) : 0;

        // Update progress
        const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
        
        const updatedMetadata: DownloadMetadata = {
          ...metadata,
          downloadedSize,
          totalSize,
          progress,
          speed,
          eta,
          startedAt,
          status: 'downloading',
          updatedAt: now,
        };
        await saveMetadata(updatedMetadata);
        
        // Update state more frequently for speed/ETA (every 2% or 500ms)
        if (progress % 2 === 0 || timeSinceLastUpdate >= 0.5) {
          setDownloads(prev => 
            prev.map(d => d.id === downloadId ? updatedMetadata : d)
          );
          setStorageUsed(await getStorageUsed());
          lastUpdateTime = now;
          lastDownloadedSize = downloadedSize;
        }
      }

      // Combine chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const videoData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        videoData.set(chunk, offset);
        offset += chunk.length;
      }

      // Encrypt the video data
      const { iv, ciphertext } = await encryptSegment(videoData.buffer, deviceKey);

      // Store encrypted video
      await saveSegment(downloadId, 0, iv, ciphertext, totalLength);

      // Update metadata as completed
      const completedMetadata: DownloadMetadata = {
        ...metadata,
        downloadedSize: totalLength,
        totalSize: totalLength,
        downloadedSegments: 1,
        progress: 100,
        status: 'completed',
        updatedAt: Date.now(),
      };
      await saveMetadata(completedMetadata);

      // Remove from active downloads
      setActiveDownloads(prev => {
        const next = new Map(prev);
        next.delete(downloadId);
        return next;
      });

      await loadDownloads();
      toast.success(`Download complete: ${metadata.episodeTitle || metadata.title}`);

    } catch (error: any) {
      if (error.message === 'Download cancelled') {
        toast.info('Download cancelled');
        return;
      }
      throw error;
    }
  };

  const pauseDownload = useCallback(async (contentId: string, episodeId?: string) => {
    const downloadId = getDownloadId(contentId, episodeId);
    const controller = activeDownloads.get(downloadId);
    if (controller) {
      controller.abort();
      setActiveDownloads(prev => {
        const next = new Map(prev);
        next.delete(downloadId);
        return next;
      });
      
      // Update metadata to paused status
      const metadata = await getMetadata(downloadId);
      if (metadata) {
        await saveMetadata({ ...metadata, status: 'paused', updatedAt: Date.now() });
        await loadDownloads();
        toast.info('Download paused');
      }
    }
  }, [activeDownloads]);

  const resumeDownload = useCallback(async (contentId: string, episodeId?: string) => {
    const downloadId = getDownloadId(contentId, episodeId);
    const metadata = await getMetadata(downloadId);
    
    if (!metadata || metadata.status !== 'paused') {
      toast.error('No paused download to resume');
      return;
    }

    // For now, restart the download (true resume would need partial file support)
    const license = await getLicense(downloadId);
    if (!license) {
      toast.error('Download license not found. Please start a new download.');
      return;
    }

    // Re-fetch content info and restart
    const { data: content } = await supabase
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (!content) {
      toast.error('Content not found');
      return;
    }

    // Reset metadata and restart
    await saveMetadata({ 
      ...metadata, 
      status: 'downloading', 
      progress: 0,
      downloadedSize: 0,
      updatedAt: Date.now() 
    });
    
    const contentObj = {
      id: content.id,
      title: content.title,
      description: content.description || '',
      thumbnailUrl: content.thumbnail_url || '',
      videoUrl: content.video_url || '',
      contentType: content.content_type as any,
      genre: content.genre || '',
      year: content.year || 0,
      rating: content.rating || '',
      duration: content.duration || 0,
      isPremium: content.is_premium || false,
      contentRating: content.content_rating || 'PG',
    };

    startDownload(contentObj, episodeId, metadata.episodeTitle, metadata.quality);
  }, [startDownload]);

  const cancelDownload = useCallback(async (contentId: string, episodeId?: string) => {
    const downloadId = getDownloadId(contentId, episodeId);
    
    // Abort if in progress
    const controller = activeDownloads.get(downloadId);
    if (controller) {
      controller.abort();
      setActiveDownloads(prev => {
        const next = new Map(prev);
        next.delete(downloadId);
        return next;
      });
    }

    // Delete from storage
    await deleteFromStorage(downloadId);
    await loadDownloads();
    toast.info('Download removed');
  }, [activeDownloads]);

  const deleteDownload = useCallback(async (contentId: string, episodeId?: string) => {
    const downloadId = getDownloadId(contentId, episodeId);
    await deleteFromStorage(downloadId);
    
    // Also delete from database
    const deviceId = getDeviceId();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase
        .from('download_licenses')
        .delete()
        .eq('content_id', contentId)
        .eq('device_id', deviceId);
    }
    
    await loadDownloads();
    toast.info('Download deleted');
  }, []);

  const getProgress = useCallback((contentId: string, episodeId?: string): DownloadProgress | null => {
    const downloadId = getDownloadId(contentId, episodeId);
    const download = downloads.find(d => d.id === downloadId);
    if (!download) return null;
    
    return {
      contentId,
      episodeId,
      progress: download.progress,
      downloadedSize: download.downloadedSize,
      totalSize: download.totalSize,
      status: download.status,
      speed: download.speed,
      eta: download.eta,
    };
  }, [downloads]);

  const isDownloaded = useCallback((contentId: string, episodeId?: string): boolean => {
    const downloadId = getDownloadId(contentId, episodeId);
    const download = downloads.find(d => d.id === downloadId);
    return download?.status === 'completed';
  }, [downloads]);

  const canPlayOffline = useCallback(async (contentId: string, episodeId?: string): Promise<boolean> => {
    const downloadId = getDownloadId(contentId, episodeId);
    const complete = await isDownloadComplete(downloadId);
    const validLicense = await isLicenseValid(downloadId);
    return complete && validLicense;
  }, []);

  const refreshLicense = useCallback(async (contentId: string, episodeId?: string): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;

    const deviceId = getDeviceId();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-download-license`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ contentId, episodeId, deviceId }),
        }
      );

      const result = await response.json();
      
      if (result.canPlay) {
        const downloadId = getDownloadId(contentId, episodeId);
        const existingLicense = await getLicense(downloadId);
        if (existingLicense) {
          await saveLicense({
            ...existingLicense,
            expiresAt: result.expiresAt,
            canPlayOffline: true,
            lastVerified: Date.now(),
          });
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to refresh license:', error);
      return false;
    }
  }, []);

  const getOfflineVideoUrl = useCallback(async (contentId: string, episodeId?: string): Promise<string | null> => {
    const downloadId = getDownloadId(contentId, episodeId);
    
    // Verify license first
    const license = await getLicense(downloadId);
    if (!license || license.expiresAt < Date.now()) {
      toast.error('Download license expired. Please re-download when online.');
      return null;
    }

    // Get the encrypted segment
    const segment = await getSegment(downloadId, 0);
    if (!segment) {
      toast.error('Downloaded content not found');
      return null;
    }

    // Decrypt
    if (!deviceKeyRef.current) {
      deviceKeyRef.current = await initDeviceKey();
    }

    const decryptedData = await decryptSegment(
      { iv: segment.iv, ciphertext: segment.ciphertext },
      deviceKeyRef.current
    );

    // Create blob URL
    const blob = new Blob([decryptedData], { type: 'video/mp4' });
    return URL.createObjectURL(blob);
  }, []);

  const clearAllOnLogout = useCallback(async () => {
    await clearAllDownloads();
    await deleteDeviceKey();
    setDownloads([]);
    setStorageUsed(0);
  }, []);

  return {
    downloads,
    isLoading,
    storageUsed,
    storageLimit: STORAGE_LIMIT,
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    deleteDownload,
    getProgress,
    isDownloaded,
    canPlayOffline,
    refreshLicense,
    getOfflineVideoUrl,
    clearAllOnLogout,
    loadDownloads,
    cleanupExpiredDownloads,
    formatBytes,
  };
}
