import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface QueueItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
}

interface CastQueueState {
  queue: QueueItem[];
  currentIndex: number;
  isQueueActive: boolean;
}

// Persist queue to localStorage for session persistence
const QUEUE_STORAGE_KEY = 'hoyeeh_cast_queue';

const loadQueueFromStorage = (): CastQueueState => {
  try {
    const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading queue from storage:', e);
  }
  return {
    queue: [],
    currentIndex: 0,
    isQueueActive: false,
  };
};

const saveQueueToStorage = (state: CastQueueState) => {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving queue to storage:', e);
  }
};

export function useCastQueue(onQueueChange?: (queue: QueueItem[]) => void) {
  const [state, setState] = useState<CastQueueState>(loadQueueFromStorage);

  // Save to storage and notify on change
  useEffect(() => {
    saveQueueToStorage(state);
    onQueueChange?.(state.queue);
  }, [state, onQueueChange]);

  const addToQueue = useCallback((item: QueueItem) => {
    setState(prev => {
      // Prevent duplicates
      if (prev.queue.some(q => q.id === item.id)) {
        toast.info(`"${item.title}" is already in queue`);
        return prev;
      }
      
      const newState = {
        ...prev,
        queue: [...prev.queue, item],
      };
      toast.success(`"${item.title}" added to queue`);
      return newState;
    });
  }, []);

  const addMultipleToQueue = useCallback((items: QueueItem[]) => {
    setState(prev => {
      const newItems = items.filter(item => !prev.queue.some(q => q.id === item.id));
      if (newItems.length === 0) {
        toast.info('Items already in queue');
        return prev;
      }
      
      const newState = {
        ...prev,
        queue: [...prev.queue, ...newItems],
      };
      toast.success(`${newItems.length} items added to queue`);
      return newState;
    });
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setState(prev => {
      const newQueue = prev.queue.filter(item => item.id !== id);
      const currentItem = prev.queue[prev.currentIndex];
      let newIndex = prev.currentIndex;
      
      if (currentItem && currentItem.id === id) {
        newIndex = Math.min(prev.currentIndex, newQueue.length - 1);
      } else {
        const removedIndex = prev.queue.findIndex(item => item.id === id);
        if (removedIndex < prev.currentIndex) {
          newIndex = prev.currentIndex - 1;
        }
      }
      
      return {
        ...prev,
        queue: newQueue,
        currentIndex: Math.max(0, newIndex),
      };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState({
      queue: [],
      currentIndex: 0,
      isQueueActive: false,
    });
    toast.info('Queue cleared');
  }, []);

  const playNext = useCallback(() => {
    setState(prev => {
      if (prev.currentIndex < prev.queue.length - 1) {
        return {
          ...prev,
          currentIndex: prev.currentIndex + 1,
        };
      }
      return {
        ...prev,
        currentIndex: 0,
        isQueueActive: false,
      };
    });
  }, []);

  const playPrevious = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));
  }, []);

  const playAtIndex = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      currentIndex: Math.max(0, Math.min(index, prev.queue.length - 1)),
      isQueueActive: true,
    }));
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newQueue = [...prev.queue];
      const [movedItem] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, movedItem);
      
      let newIndex = prev.currentIndex;
      if (fromIndex === prev.currentIndex) {
        newIndex = toIndex;
      } else if (fromIndex < prev.currentIndex && toIndex >= prev.currentIndex) {
        newIndex = prev.currentIndex - 1;
      } else if (fromIndex > prev.currentIndex && toIndex <= prev.currentIndex) {
        newIndex = prev.currentIndex + 1;
      }
      
      return {
        ...prev,
        queue: newQueue,
        currentIndex: newIndex,
      };
    });
  }, []);

  const startQueue = useCallback(() => {
    if (state.queue.length > 0) {
      setState(prev => ({
        ...prev,
        isQueueActive: true,
      }));
    }
  }, [state.queue.length]);

  const setQueue = useCallback((queue: QueueItem[]) => {
    setState(prev => ({
      ...prev,
      queue,
    }));
  }, []);

  const currentItem = state.queue[state.currentIndex] || null;
  const hasNext = state.currentIndex < state.queue.length - 1;
  const hasPrevious = state.currentIndex > 0;

  return {
    queue: state.queue,
    currentIndex: state.currentIndex,
    currentItem,
    isQueueActive: state.isQueueActive,
    hasNext,
    hasPrevious,
    addToQueue,
    addMultipleToQueue,
    removeFromQueue,
    clearQueue,
    playNext,
    playPrevious,
    playAtIndex,
    reorderQueue,
    startQueue,
    setQueue,
  };
}
