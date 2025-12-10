import { useState, useCallback, useRef, useEffect } from 'react';
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

export function useCastQueue() {
  const [state, setState] = useState<CastQueueState>({
    queue: [],
    currentIndex: 0,
    isQueueActive: false,
  });

  const addToQueue = useCallback((item: QueueItem) => {
    setState(prev => ({
      ...prev,
      queue: [...prev.queue, item],
    }));
    toast.success(`"${item.title}" added to queue`);
  }, []);

  const addMultipleToQueue = useCallback((items: QueueItem[]) => {
    setState(prev => ({
      ...prev,
      queue: [...prev.queue, ...items],
    }));
    toast.success(`${items.length} items added to queue`);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setState(prev => {
      const newQueue = prev.queue.filter(item => item.id !== id);
      const currentItem = prev.queue[prev.currentIndex];
      let newIndex = prev.currentIndex;
      
      // Adjust index if removing item before or at current
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
    setState(prev => ({
      ...prev,
      queue: [],
      currentIndex: 0,
      isQueueActive: false,
    }));
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
      // Loop back to start or stop
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
      
      // Adjust current index if affected
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
  };
}
