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
  // Partial download support
  savePartialChunk,
  getPartialChunks,
  getPartialDownloadedSize,
  deletePartialChunks,
  combinePartialChunks,
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
  const pausedByNetworkRef = useRef<Set<string>>(new Set());

  // Load downloads on mount
  useEffect(() => {
    loadDownloads();
    initializeDeviceKey();
  }, []);

  // Cleanup expired downloads on mount
  useEffect(() => {
    cleanupExpiredDownloads();
  }, []);

  // Auto pause/resume based on network changes
  useEffect(() => {
    const wifiOnlyEnabled = localStorage.getItem('hoyeeh-wifi-only-downloads') === 'true';
    if (!wifiOnlyEnabled) return;

    const handleNetworkChange = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      
      if (!connection) return;
      
      const connectionType = connection.type || '';
      const effectiveType = connection.effectiveType || '';
      const mobileTypes = ['cellular', '2g', '3g', '4g', '5g'];
      const isWifi = !mobileTypes.includes(connectionType) && 
                     !mobileTypes.includes(effectiveType) ||
                     connectionType === 'wifi' || connectionType === 'ethernet';

      if (!isWifi) {
        // Switched to mobile data - pause all active downloads
        activeDownloads.forEach((controller, downloadId) => {
          controller.abort();
          pausedByNetworkRef.current.add(downloadId);
          toast.warning('Downloads paused - switched to mobile data');
        });
      } else if (pausedByNetworkRef.current.size > 0) {
        // Switched back to Wi-Fi - notify user (can't auto-resume easily)
        toast.success(`Wi-Fi connected. ${pausedByNetworkRef.current.size} download(s) ready to resume.`);
        pausedByNetworkRef.current.clear();
      }
    };

    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      connection.addEventListener('change', handleNetworkChange);
      return () => connection.removeEventListener('change', handleNetworkChange);
    }
  }, [activeDownloads]);

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

    // Check Wi-Fi only setting
    const wifiOnlyEnabled = localStorage.getItem('hoyeeh-wifi-only-downloads') === 'true';
    if (wifiOnlyEnabled) {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      if (connection) {
        const mobileTypes = ['cellular', '2g', '3g', '4g', '5g'];
        const connectionType = connection.type || '';
        const effectiveType = connection.effectiveType || '';
        if (mobileTypes.includes(connectionType) || mobileTypes.includes(effectiveType)) {
          toast.error('Wi-Fi only mode is enabled. Connect to Wi-Fi to download.');
          return;
        }
      }
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
        contentRating: manifest.contentRating || content.contentRating, // Store content rating for kids filtering
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

    } catch (error: any) {
      console.error('[startDownload] Download error:', error);
      const errorMessage = error?.message || 'Download failed';
      toast.error(errorMessage === 'Download failed' ? 'Download failed. Please try again.' : errorMessage);
      
      // Remove from active downloads
      setActiveDownloads(prev => {
        const next = new Map(prev);
        next.delete(downloadId);
        return next;
      });
      
      // Update status to failed
      const metadata = await getMetadata(downloadId);
      if (metadata) {
        await saveMetadata({ ...metadata, status: 'failed', updatedAt: Date.now() });
        await loadDownloads();
      }
    }
  }, [user, activeDownloads]);

  // Download video with partial file support for true resume
  const downloadVideo = async (
    videoUrl: string,
    downloadId: string,
    metadata: DownloadMetadata,
    deviceKey: CryptoKey,
    signal: AbortSignal,
    resumeFromByte: number = 0
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Build headers for range request (resume support)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };
      if (resumeFromByte > 0) headers['Range'] = `bytes=${resumeFromByte}-`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-video`,
        {
          method: 'POST',
          headers,
          // Server resolves the file from the ids and re-checks entitlement.
          body: JSON.stringify({
            contentId: metadata.contentId,
            episodeId: metadata.episodeId || undefined,
          }),
          signal,
        }
      );

      if (!response.ok) {
        let errorMessage = 'Failed to fetch video';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('[downloadVideo] Edge function error:', errorData);
        } catch {
          console.error('[downloadVideo] Non-JSON error response:', response.status, response.statusText);
        }
        throw new Error(errorMessage);
      }

      console.log('[downloadVideo] Video stream started, status:', response.status);

      const contentLength = response.headers.get('content-length');
      const contentRange = response.headers.get('content-range');
      
      // Parse total size from Content-Range header if resuming
      let totalSize: number;
      if (contentRange) {
        // Format: bytes 0-999/1000 or bytes 500-999/1000
        const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
        totalSize = match ? parseInt(match[1], 10) : metadata.totalSize;
      } else {
        totalSize = contentLength ? parseInt(contentLength, 10) + resumeFromByte : metadata.totalSize;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      let downloadedSize = resumeFromByte;
      const startedAt = Date.now();
      let lastUpdateTime = startedAt;
      let lastDownloadedSize = downloadedSize;
      let chunkIndex = 0;

      // Get existing chunks count if resuming
      if (resumeFromByte > 0) {
        const existingChunks = await getPartialChunks(downloadId);
        chunkIndex = existingChunks.length;
      }

      const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for partial storage
      let currentChunk: Uint8Array[] = [];
      let currentChunkSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        if (signal.aborted) {
          reader.cancel();
          // Save any remaining partial data before throwing
          if (currentChunkSize > 0) {
            const chunkData = combineChunkArray(currentChunk, currentChunkSize);
            await savePartialChunk(downloadId, chunkIndex, chunkData, downloadedSize - currentChunkSize);
          }
          throw new Error('Download cancelled');
        }

        currentChunk.push(value);
        currentChunkSize += value.length;
        downloadedSize += value.length;

        // Save chunk to IndexedDB when it reaches CHUNK_SIZE (for resume support)
        if (currentChunkSize >= CHUNK_SIZE) {
          const chunkData = combineChunkArray(currentChunk, currentChunkSize);
          await savePartialChunk(downloadId, chunkIndex, chunkData, downloadedSize - currentChunkSize);
          chunkIndex++;
          currentChunk = [];
          currentChunkSize = 0;
        }

        const now = Date.now();
        const timeSinceStart = (now - startedAt) / 1000;
        const timeSinceLastUpdate = (now - lastUpdateTime) / 1000;

        // Calculate speed
        const bytesDownloadedThisSession = downloadedSize - resumeFromByte;
        const overallSpeed = timeSinceStart > 0 ? bytesDownloadedThisSession / timeSinceStart : 0;
        const recentSpeed = timeSinceLastUpdate > 0 ? (downloadedSize - lastDownloadedSize) / timeSinceLastUpdate : overallSpeed;
        const speed = Math.round((overallSpeed + recentSpeed) / 2);

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
          videoUrl, // Store for resume
        };
        await saveMetadata(updatedMetadata);
        
        // Update state periodically
        if (progress % 2 === 0 || timeSinceLastUpdate >= 0.5) {
          setDownloads(prev => 
            prev.map(d => d.id === downloadId ? updatedMetadata : d)
          );
          setStorageUsed(await getStorageUsed());
          lastUpdateTime = now;
          lastDownloadedSize = downloadedSize;
        }
      }

      // Save any remaining partial chunk
      if (currentChunkSize > 0) {
        const chunkData = combineChunkArray(currentChunk, currentChunkSize);
        await savePartialChunk(downloadId, chunkIndex, chunkData, downloadedSize - currentChunkSize);
      }

      // Combine all partial chunks into final video
      const videoData = await combinePartialChunks(downloadId);
      if (!videoData) {
        throw new Error('Failed to combine downloaded chunks');
      }

      // Encrypt the video data
      const { iv, ciphertext } = await encryptSegment(videoData, deviceKey);

      // Store encrypted video
      await saveSegment(downloadId, 0, iv, ciphertext, videoData.byteLength);

      // Delete partial chunks (no longer needed)
      await deletePartialChunks(downloadId);

      // Update metadata as completed
      const completedMetadata: DownloadMetadata = {
        ...metadata,
        downloadedSize: videoData.byteLength,
        totalSize: videoData.byteLength,
        downloadedSegments: 1,
        progress: 100,
        status: 'completed',
        updatedAt: Date.now(),
      };
      await saveMetadata(completedMetadata);

      // Sync completion status to database
      const deviceId = getDeviceId();
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        // Build the query - handle episode_id being null for movies
        let query = supabase
          .from('download_licenses')
          .update({ 
            status: 'completed', 
            downloaded_at: new Date().toISOString(),
            total_size: videoData.byteLength,
          })
          .eq('content_id', metadata.contentId)
          .eq('device_id', deviceId)
          .eq('user_id', sessionData.session.user.id);
        
        // Add episode_id filter (handles null for movies)
        if (metadata.episodeId) {
          query = query.eq('episode_id', metadata.episodeId);
        } else {
          query = query.is('episode_id', null);
        }
        
        const { error: updateError } = await query;
        if (updateError) {
          console.error('[downloadVideo] Failed to update license status:', updateError);
        } else {
          console.log('[downloadVideo] License status updated to completed');
        }
      }

      // Remove from active downloads
      setActiveDownloads(prev => {
        const next = new Map(prev);
        next.delete(downloadId);
        return next;
      });

      await loadDownloads();

      // Ask the browser to mark storage as persistent so offline downloads
      // are not evicted under storage pressure (runs once per device).
      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.storage?.persist &&
          navigator.storage?.persisted &&
          !localStorage.getItem("hoyeeh-storage-persist-requested")
        ) {
          const already = await navigator.storage.persisted();
          if (!already) {
            await navigator.storage.persist();
          }
          localStorage.setItem("hoyeeh-storage-persist-requested", "1");
        }
      } catch (e) {
        console.warn("[downloadVideo] storage.persist() not available:", e);
      }

      toast.success(`Download complete: ${metadata.episodeTitle || metadata.title}`);

    } catch (error: any) {
      if (error.message === 'Download cancelled') {
        // Save current progress for resume
        const currentMetadata = await getMetadata(downloadId);
        if (currentMetadata) {
          await saveMetadata({ 
            ...currentMetadata, 
            status: 'paused', 
            updatedAt: Date.now() 
          });
          await loadDownloads();
        }
        toast.info('Download paused - can be resumed later');
        return;
      }
      throw error;
    }
  };

  // Helper to combine array of Uint8Arrays
  const combineChunkArray = (chunks: Uint8Array[], totalSize: number): ArrayBuffer => {
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined.buffer;
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

    // Check if we have partial data to resume from
    const partialSize = await getPartialDownloadedSize(downloadId);
    
    const license = await getLicense(downloadId);
    if (!license) {
      toast.error('Download license not found. Please start a new download.');
      return;
    }

    // Check if license is still valid
    if (license.expiresAt < Date.now()) {
      toast.error('Download license expired. Please start a new download.');
      return;
    }

    // Check Wi-Fi only setting
    const wifiOnlyEnabled = localStorage.getItem('hoyeeh-wifi-only-downloads') === 'true';
    if (wifiOnlyEnabled) {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;
      if (connection) {
        const mobileTypes = ['cellular', '2g', '3g', '4g', '5g'];
        const connectionType = connection.type || '';
        const effectiveType = connection.effectiveType || '';
        if (mobileTypes.includes(connectionType) || mobileTypes.includes(effectiveType)) {
          toast.error('Wi-Fi only mode is enabled. Connect to Wi-Fi to resume.');
          return;
        }
      }
    }

    // Initialize device key
    if (!deviceKeyRef.current) {
      deviceKeyRef.current = await initDeviceKey();
    }

    // Get video URL from metadata or fetch fresh
    let videoUrl = metadata.videoUrl;
    if (!videoUrl) {
      // Fetch content info to get video URL
      if (episodeId) {
        const { data: episode } = await supabase
          .from('episodes')
          .select('video_url')
          .eq('id', episodeId)
          .single();
        videoUrl = episode?.video_url || '';
      } else {
        const { data: content } = await supabase
          .from('content')
          .select('video_url')
          .eq('id', contentId)
          .single();
        videoUrl = content?.video_url || '';
      }
    }

    if (!videoUrl) {
      toast.error('Video URL not available');
      return;
    }

    // Update metadata to downloading
    await saveMetadata({ 
      ...metadata, 
      status: 'downloading', 
      updatedAt: Date.now(),
      videoUrl,
    });
    await loadDownloads();

    // Create abort controller for this download
    const abortController = new AbortController();
    setActiveDownloads(prev => new Map(prev).set(downloadId, abortController));

    try {
      toast.info(`Resuming download from ${formatBytes(partialSize)}`);
      
      // Resume download from where we left off
      await downloadVideo(
        videoUrl,
        downloadId,
        { ...metadata, videoUrl },
        deviceKeyRef.current,
        abortController.signal,
        partialSize // Resume from this byte position
      );
    } catch (error) {
      console.error('Resume download error:', error);
      toast.error('Failed to resume download');
      
      // Revert to paused status
      await saveMetadata({ ...metadata, status: 'paused', updatedAt: Date.now() });
      await loadDownloads();
    }
  }, [activeDownloads]);

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

  const getLicenseExpiry = useCallback(async (contentId: string, episodeId?: string): Promise<number | null> => {
    const downloadId = getDownloadId(contentId, episodeId);
    const license = await getLicense(downloadId);
    return license?.expiresAt || null;
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
    getLicenseExpiry,
    getOfflineVideoUrl,
    clearAllOnLogout,
    loadDownloads,
    cleanupExpiredDownloads,
    formatBytes,
  };
}
