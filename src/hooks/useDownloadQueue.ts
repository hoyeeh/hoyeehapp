import { useState, useEffect, useCallback, useRef } from 'react';
import { Content } from '@/types';
import { getMetadata, saveMetadata, type DownloadMetadata } from '@/lib/downloadStorage';

export interface QueuedDownload {
  id: string;
  content: Content;
  episodeId?: string;
  episodeTitle?: string;
  quality: string;
  priority: number; // Higher = more priority
  addedAt: number;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
  retryCount: number;
}

interface DownloadQueueOptions {
  maxConcurrent?: number;
  maxRetries?: number;
  onStartDownload: (item: QueuedDownload) => Promise<void>;
}

const QUEUE_STORAGE_KEY = 'hoyeeh-download-queue';
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_MAX_RETRIES = 3;

export function useDownloadQueue(options: DownloadQueueOptions) {
  const { 
    maxConcurrent = DEFAULT_MAX_CONCURRENT, 
    maxRetries = DEFAULT_MAX_RETRIES,
    onStartDownload 
  } = options;

  const [queue, setQueue] = useState<QueuedDownload[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const processingRef = useRef(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (savedQueue) {
      try {
        const parsed = JSON.parse(savedQueue) as QueuedDownload[];
        // Reset any 'downloading' items to 'queued' (they were interrupted)
        const restored = parsed.map(item => ({
          ...item,
          status: item.status === 'downloading' ? 'queued' : item.status
        })) as QueuedDownload[];
        setQueue(restored.filter(q => q.status === 'queued' || q.status === 'paused'));
      } catch (e) {
        console.error('Failed to restore download queue:', e);
      }
    }
  }, []);

  // Save queue to localStorage on changes
  useEffect(() => {
    const toSave = queue.filter(q => q.status === 'queued' || q.status === 'paused');
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(toSave));
  }, [queue]);

  // Process queue when items change or active count changes
  useEffect(() => {
    processQueue();
  }, [queue, activeCount]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const queuedItems = queue
        .filter(q => q.status === 'queued')
        .sort((a, b) => {
          // Sort by priority (desc) then by addedAt (asc)
          if (b.priority !== a.priority) return b.priority - a.priority;
          return a.addedAt - b.addedAt;
        });

      const slotsAvailable = maxConcurrent - activeCount;
      const itemsToStart = queuedItems.slice(0, slotsAvailable);

      for (const item of itemsToStart) {
        // Update status to downloading
        setQueue(prev => prev.map(q => 
          q.id === item.id ? { ...q, status: 'downloading' as const } : q
        ));
        setActiveCount(prev => prev + 1);

        // Start the download
        try {
          await onStartDownload(item);
          // Mark as completed
          setQueue(prev => prev.map(q => 
            q.id === item.id ? { ...q, status: 'completed' as const } : q
          ));
        } catch (error) {
          console.error(`Queue item ${item.id} failed:`, error);
          // Handle retry
          if (item.retryCount < maxRetries) {
            setQueue(prev => prev.map(q => 
              q.id === item.id 
                ? { ...q, status: 'queued' as const, retryCount: q.retryCount + 1 } 
                : q
            ));
          } else {
            setQueue(prev => prev.map(q => 
              q.id === item.id ? { ...q, status: 'failed' as const } : q
            ));
          }
        } finally {
          setActiveCount(prev => Math.max(0, prev - 1));
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [queue, activeCount, maxConcurrent, maxRetries, onStartDownload]);

  const addToQueue = useCallback((
    content: Content,
    episodeId?: string,
    episodeTitle?: string,
    quality: string = '720p',
    priority: number = 5
  ): string => {
    const id = episodeId ? `${content.id}_${episodeId}` : content.id;
    
    // Check if already in queue
    const existing = queue.find(q => q.id === id);
    if (existing) {
      if (existing.status === 'paused') {
        // Resume paused item
        setQueue(prev => prev.map(q => 
          q.id === id ? { ...q, status: 'queued' as const } : q
        ));
      }
      return id;
    }

    const newItem: QueuedDownload = {
      id,
      content,
      episodeId,
      episodeTitle,
      quality,
      priority,
      addedAt: Date.now(),
      status: 'queued',
      retryCount: 0,
    };

    setQueue(prev => [...prev, newItem]);
    return id;
  }, [queue]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  }, []);

  const pauseQueueItem = useCallback((id: string) => {
    setQueue(prev => prev.map(q => 
      q.id === id && q.status === 'queued' 
        ? { ...q, status: 'paused' as const } 
        : q
    ));
  }, []);

  const resumeQueueItem = useCallback((id: string) => {
    setQueue(prev => prev.map(q => 
      q.id === id && q.status === 'paused' 
        ? { ...q, status: 'queued' as const } 
        : q
    ));
  }, []);

  const updatePriority = useCallback((id: string, priority: number) => {
    setQueue(prev => prev.map(q => 
      q.id === id ? { ...q, priority } : q
    ));
  }, []);

  const moveToFront = useCallback((id: string) => {
    const maxPriority = Math.max(...queue.map(q => q.priority), 0);
    updatePriority(id, maxPriority + 1);
  }, [queue, updatePriority]);

  const moveToBack = useCallback((id: string) => {
    const minPriority = Math.min(...queue.map(q => q.priority), 10);
    updatePriority(id, Math.max(1, minPriority - 1));
  }, [queue, updatePriority]);

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(q => q.status !== 'completed' && q.status !== 'failed'));
  }, []);

  const pauseAll = useCallback(() => {
    setQueue(prev => prev.map(q => 
      q.status === 'queued' ? { ...q, status: 'paused' as const } : q
    ));
  }, []);

  const resumeAll = useCallback(() => {
    setQueue(prev => prev.map(q => 
      q.status === 'paused' ? { ...q, status: 'queued' as const } : q
    ));
  }, []);

  const getQueuePosition = useCallback((id: string): number => {
    const sortedQueue = [...queue]
      .filter(q => q.status === 'queued')
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.addedAt - b.addedAt;
      });
    return sortedQueue.findIndex(q => q.id === id) + 1;
  }, [queue]);

  return {
    queue,
    activeCount,
    maxConcurrent,
    addToQueue,
    removeFromQueue,
    pauseQueueItem,
    resumeQueueItem,
    updatePriority,
    moveToFront,
    moveToBack,
    clearCompleted,
    pauseAll,
    resumeAll,
    getQueuePosition,
    isQueueFull: activeCount >= maxConcurrent,
  };
}
