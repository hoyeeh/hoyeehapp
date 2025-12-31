import { useState, useEffect, useCallback } from 'react';

interface CacheStats {
  totalSize: number;
  cacheBreakdown: { name: string; size: number }[];
  storageQuota: number;
  storageUsage: number;
  percentUsed: number;
  isOverQuota: boolean;
}

const CLEANUP_THRESHOLD = 0.85; // Start cleanup at 85% usage
const TARGET_AFTER_CLEANUP = 0.70; // Clean to 70% usage

export function useCacheMonitor() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastCleanup, setLastCleanup] = useState<Date | null>(null);

  // Calculate cache sizes
  const getCacheStats = useCallback(async (): Promise<CacheStats> => {
    let storageQuota = 0;
    let storageUsage = 0;

    // Get storage estimate if available
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        storageQuota = estimate.quota || 0;
        storageUsage = estimate.usage || 0;
      } catch (e) {
        console.warn('Storage estimate failed:', e);
      }
    }

    // Get individual cache sizes
    const cacheBreakdown: { name: string; size: number }[] = [];
    let totalSize = 0;

    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        
        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          let cacheSize = 0;

          for (const request of keys) {
            try {
              const response = await cache.match(request);
              if (response) {
                const blob = await response.clone().blob();
                cacheSize += blob.size;
              }
            } catch {
              // Skip if we can't read the response
            }
          }

          cacheBreakdown.push({ name, size: cacheSize });
          totalSize += cacheSize;
        }
      } catch (e) {
        console.warn('Cache size calculation failed:', e);
      }
    }

    const percentUsed = storageQuota > 0 ? (storageUsage / storageQuota) * 100 : 0;
    const isOverQuota = percentUsed >= CLEANUP_THRESHOLD * 100;

    return {
      totalSize,
      cacheBreakdown,
      storageQuota,
      storageUsage,
      percentUsed,
      isOverQuota,
    };
  }, []);

  // Clean up old cache entries
  const cleanupCache = useCallback(async (aggressive = false): Promise<number> => {
    let bytesFreed = 0;
    
    if (!('caches' in window)) return bytesFreed;

    try {
      const cacheNames = await caches.keys();
      
      // Priority order for cleanup (least important first)
      const cleanupPriority = [
        'tmdb-images',
        'supabase-cache',
        'hoyeeh-v2',
        // Don't touch downloads cache
      ];

      for (const name of cleanupPriority) {
        if (!cacheNames.includes(name)) continue;
        
        const cache = await caches.open(name);
        const keys = await cache.keys();

        // Sort by least recently used (if we had that data)
        // For now, remove oldest entries first
        const keysToRemove = aggressive ? keys : keys.slice(0, Math.floor(keys.length / 2));

        for (const request of keysToRemove) {
          try {
            const response = await cache.match(request);
            if (response) {
              const blob = await response.clone().blob();
              bytesFreed += blob.size;
            }
            await cache.delete(request);
          } catch {
            // Skip if we can't delete
          }
        }

        // Check if we've freed enough
        const currentStats = await getCacheStats();
        if (currentStats.percentUsed < TARGET_AFTER_CLEANUP * 100) {
          break;
        }
      }

      setLastCleanup(new Date());
      console.log(`Cache cleanup freed ${formatBytes(bytesFreed)}`);
      
    } catch (e) {
      console.error('Cache cleanup failed:', e);
    }

    return bytesFreed;
  }, [getCacheStats]);

  // Auto-cleanup when over threshold
  const checkAndCleanup = useCallback(async () => {
    const currentStats = await getCacheStats();
    setStats(currentStats);

    if (currentStats.isOverQuota) {
      console.log('Storage quota exceeded threshold, starting cleanup...');
      await cleanupCache();
      // Refresh stats after cleanup
      const newStats = await getCacheStats();
      setStats(newStats);
    }
  }, [cleanupCache, getCacheStats]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    checkAndCleanup();

    // Check every 5 minutes
    const interval = setInterval(checkAndCleanup, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, [checkAndCleanup]);

  // Initial load
  useEffect(() => {
    getCacheStats().then(setStats);
  }, [getCacheStats]);

  return {
    stats,
    isMonitoring,
    lastCleanup,
    startMonitoring,
    getCacheStats,
    cleanupCache,
    checkAndCleanup,
  };
}

// Helper function to format bytes
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
