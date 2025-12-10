import { useState, useEffect, useCallback } from 'react';

interface PendingUpload {
  id: string;
  fileName: string;
  fileSize: number;
  folder: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  createdAt: number;
  error?: string;
}

interface UploadQueue {
  uploads: PendingUpload[];
  lastUpdated: number;
}

const STORAGE_KEY = 'hoyeeh_upload_queue';
const QUEUE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useUploadPersistence = () => {
  const [queue, setQueue] = useState<PendingUpload[]>([]);

  // Load queue from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: UploadQueue = JSON.parse(stored);
        // Filter out expired entries
        const now = Date.now();
        const validUploads = parsed.uploads.filter(
          upload => now - upload.createdAt < QUEUE_EXPIRY_MS
        );
        setQueue(validUploads);
        
        // Clean up storage if we removed expired items
        if (validUploads.length !== parsed.uploads.length) {
          saveQueue(validUploads);
        }
      } catch (error) {
        console.error('Failed to parse upload queue:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const saveQueue = useCallback((uploads: PendingUpload[]) => {
    const queueData: UploadQueue = {
      uploads,
      lastUpdated: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queueData));
  }, []);

  const addUpload = useCallback((fileName: string, fileSize: number, folder: string): string => {
    const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newUpload: PendingUpload = {
      id,
      fileName,
      fileSize,
      folder,
      progress: 0,
      status: 'pending',
      createdAt: Date.now()
    };
    
    setQueue(prev => {
      const updated = [...prev, newUpload];
      saveQueue(updated);
      return updated;
    });
    
    return id;
  }, [saveQueue]);

  const updateUpload = useCallback((id: string, updates: Partial<PendingUpload>) => {
    setQueue(prev => {
      const updated = prev.map(upload =>
        upload.id === id ? { ...upload, ...updates } : upload
      );
      saveQueue(updated);
      return updated;
    });
  }, [saveQueue]);

  const removeUpload = useCallback((id: string) => {
    setQueue(prev => {
      const updated = prev.filter(upload => upload.id !== id);
      saveQueue(updated);
      return updated;
    });
  }, [saveQueue]);

  const clearCompleted = useCallback(() => {
    setQueue(prev => {
      const updated = prev.filter(upload => upload.status !== 'completed');
      saveQueue(updated);
      return updated;
    });
  }, [saveQueue]);

  const clearAll = useCallback(() => {
    setQueue([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getPendingUploads = useCallback(() => {
    return queue.filter(upload => upload.status === 'pending' || upload.status === 'failed');
  }, [queue]);

  const getActiveUploads = useCallback(() => {
    return queue.filter(upload => upload.status === 'uploading');
  }, [queue]);

  return {
    queue,
    addUpload,
    updateUpload,
    removeUpload,
    clearCompleted,
    clearAll,
    getPendingUploads,
    getActiveUploads
  };
};
