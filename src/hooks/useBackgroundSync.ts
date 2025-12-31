import { useEffect, useCallback, useState, useRef } from 'react';
import { toast } from 'sonner';

// Queue for offline actions
interface OfflineAction {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  retryCount: number;
}

const OFFLINE_QUEUE_KEY = 'hoyeeh-offline-queue';
const MAX_RETRIES = 3;

export function useBackgroundSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const syncInProgress = useRef(false);

  // Load pending actions from storage
  const loadPendingActions = useCallback(() => {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        const actions = JSON.parse(stored) as OfflineAction[];
        setPendingActions(actions);
        return actions;
      }
    } catch (e) {
      console.error('Failed to load offline queue:', e);
    }
    return [];
  }, []);

  // Save pending actions to storage
  const savePendingActions = useCallback((actions: OfflineAction[]) => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(actions));
      setPendingActions(actions);
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }, []);

  // Queue an action for later sync
  const queueAction = useCallback((type: string, payload: unknown) => {
    const action: OfflineAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const actions = loadPendingActions();
    savePendingActions([...actions, action]);

    if (!isOnline) {
      toast.info('Action queued for sync when online', { duration: 2000 });
    }

    return action.id;
  }, [isOnline, loadPendingActions, savePendingActions]);

  // Process a single action
  const processAction = useCallback(async (action: OfflineAction): Promise<boolean> => {
    try {
      // Dispatch custom event for action processing
      const event = new CustomEvent('offline-action-sync', {
        detail: { type: action.type, payload: action.payload },
      });
      window.dispatchEvent(event);

      // Action-specific processing would be handled by listeners
      // For now, we mark it as successful
      return true;
    } catch (error) {
      console.error(`Failed to process action ${action.id}:`, error);
      return false;
    }
  }, []);

  // Sync all pending actions
  const syncPendingActions = useCallback(async () => {
    if (syncInProgress.current || !isOnline) return;

    const actions = loadPendingActions();
    if (actions.length === 0) return;

    syncInProgress.current = true;
    setIsSyncing(true);

    const remainingActions: OfflineAction[] = [];
    let successCount = 0;

    for (const action of actions) {
      const success = await processAction(action);
      
      if (success) {
        successCount++;
      } else {
        action.retryCount++;
        if (action.retryCount < MAX_RETRIES) {
          remainingActions.push(action);
        }
      }
    }

    savePendingActions(remainingActions);
    syncInProgress.current = false;
    setIsSyncing(false);

    if (successCount > 0) {
      toast.success(`Synced ${successCount} offline action${successCount > 1 ? 's' : ''}`);
    }
  }, [isOnline, loadPendingActions, processAction, savePendingActions]);

  // Register for background sync if supported
  const registerBackgroundSync = useCallback(async () => {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('sync-offline-actions');
        console.log('Background sync registered');
      } catch (e) {
        console.warn('Background sync registration failed:', e);
      }
    }
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online!', { duration: 2000 });
      // Sync pending actions when coming back online
      setTimeout(syncPendingActions, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Actions will be synced when connected.', { duration: 3000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load initial pending actions
    loadPendingActions();

    // Register for background sync
    registerBackgroundSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadPendingActions, registerBackgroundSync, syncPendingActions]);

  // Clear all pending actions
  const clearPendingActions = useCallback(() => {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    setPendingActions([]);
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingActions,
    pendingCount: pendingActions.length,
    queueAction,
    syncPendingActions,
    clearPendingActions,
  };
}
