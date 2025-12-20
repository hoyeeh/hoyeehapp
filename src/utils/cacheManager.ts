// Centralized cache management for Hoyeeh app
// Consolidates all localStorage/sessionStorage keys

// Define all known cache keys with their purposes
export const CACHE_KEYS = {
  // Authentication (PRESERVE)
  auth: {
    supabaseAuthToken: 'sb-astugmzoxhxcyipxsojl-auth-token',
  },
  
  // Downloads (PRESERVE encryption keys, can clear metadata)
  downloads: {
    deviceKey: 'hoyeeh-device-key', // CRITICAL - never clear
    wifiOnly: 'hoyeeh-wifi-only-downloads',
    pausedByNetwork: 'hoyeeh-paused-by-network',
    preferredQuality: 'preferred-download-quality',
    smartDownload: 'smart-download',
  },
  
  // User preferences (safe to clear)
  preferences: {
    uploadMode: 'video-upload-mode',
    theme: 'theme',
    sidebarState: 'sidebar:state',
    onboardingComplete: 'hoyeeh_onboarding_complete',
    profileSelection: 'selectedProfile',
    kidsTimeUsage: 'kids-time-usage',
    impersonationMode: 'admin-impersonation-mode',
  },
  
  // Session data (safe to clear)
  session: {
    randomBanner: 'hoyeeh_random_banner',
    pinRegistration: 'pinRegistrationData',
    uploadQueue: 'hoyeeh-upload-queue',
  },
  
  // Legacy/duplicate keys to remove
  legacy: [
    'wifi-only-download', // Old key, replaced by hoyeeh-wifi-only-downloads
    'wifiOnlyDownloads', // Another duplicate
  ] as string[],
};

// Keys that should NEVER be cleared
const PROTECTED_KEYS: string[] = [
  CACHE_KEYS.auth.supabaseAuthToken,
  CACHE_KEYS.downloads.deviceKey,
];

/**
 * Get all known cache keys as a Set
 */
function getAllKnownKeys(): Set<string> {
  return new Set([
    ...Object.values(CACHE_KEYS.auth),
    ...Object.values(CACHE_KEYS.downloads),
    ...Object.values(CACHE_KEYS.preferences),
    ...Object.values(CACHE_KEYS.session),
  ]);
}

/**
 * Migrate legacy keys to new consolidated keys
 */
export function migrateLegacyKeys(): void {
  // Migrate wifi-only download keys
  const legacyWifiOnly = localStorage.getItem('wifi-only-download') 
    || localStorage.getItem('wifiOnlyDownloads');
  
  if (legacyWifiOnly && !localStorage.getItem(CACHE_KEYS.downloads.wifiOnly)) {
    localStorage.setItem(CACHE_KEYS.downloads.wifiOnly, legacyWifiOnly);
  }
  
  // Remove legacy keys
  CACHE_KEYS.legacy.forEach(key => {
    localStorage.removeItem(key);
  });
}

/**
 * Clear orphaned data (old/unused cache entries)
 */
export function clearOrphanedData(): number {
  let clearedCount = 0;
  const knownKeys = getAllKnownKeys();
  
  // Get all localStorage keys
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    // Skip known keys
    if (knownKeys.has(key)) continue;
    
    // Skip Supabase auth keys
    if (key.startsWith('sb-')) continue;
    
    // Skip IndexedDB-related keys
    if (key.includes('idb-')) continue;
    
    // Remove unknown/orphaned keys
    localStorage.removeItem(key);
    clearedCount++;
  }
  
  return clearedCount;
}

/**
 * Clear session-related data (safe to clear)
 */
export function clearSessionData(): void {
  Object.values(CACHE_KEYS.session).forEach(key => {
    localStorage.removeItem(key);
  });
  sessionStorage.clear();
}

/**
 * Clear preferences (user settings)
 */
export function clearPreferences(): void {
  Object.values(CACHE_KEYS.preferences).forEach(key => {
    localStorage.removeItem(key);
  });
}

/**
 * Selective cache cleanup - clears orphaned data while preserving auth and downloads
 */
export function selectiveCacheCleanup(): { migrated: boolean; orphansCleared: number } {
  // Step 1: Migrate legacy keys
  migrateLegacyKeys();
  
  // Step 2: Clear orphaned data
  const orphansCleared = clearOrphanedData();
  
  // Step 3: Clear session storage (temporary data)
  sessionStorage.clear();
  
  return {
    migrated: true,
    orphansCleared,
  };
}

/**
 * Full cache clear (except protected keys)
 * WARNING: This will log user out and clear download settings
 */
export async function fullCacheClear(): Promise<void> {
  // Clear localStorage except protected keys
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && !PROTECTED_KEYS.includes(key)) {
      localStorage.removeItem(key);
    }
  }
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Clear IndexedDB (downloads database)
  try {
    const databases = await indexedDB.databases?.() || [];
    for (const db of databases) {
      if (db.name && db.name.includes('hoyeeh')) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  } catch (e) {
    console.warn('Could not clear IndexedDB:', e);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalKeys: number;
  knownKeys: number;
  orphanedKeys: number;
  sessionKeys: number;
} {
  const knownKeys = getAllKnownKeys();
  
  let totalKeys = 0;
  let knownCount = 0;
  let orphanedCount = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    totalKeys++;
    
    if (knownKeys.has(key) || key.startsWith('sb-')) {
      knownCount++;
    } else {
      orphanedCount++;
    }
  }
  
  return {
    totalKeys,
    knownKeys: knownCount,
    orphanedKeys: orphanedCount,
    sessionKeys: sessionStorage.length,
  };
}

/**
 * Clear service worker caches for production deployment
 */
export async function clearServiceWorkerCaches(): Promise<number> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      let cleared = 0;
      for (const cacheName of cacheNames) {
        // Don't clear downloads cache
        if (!cacheName.includes('download')) {
          await caches.delete(cacheName);
          cleared++;
        }
      }
      return cleared;
    } catch (e) {
      console.warn('Could not clear caches:', e);
      return 0;
    }
  }
  return 0;
}

/**
 * Force service worker update
 */
export async function forceServiceWorkerUpdate(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        // Tell waiting SW to skip waiting
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        return true;
      }
    } catch (e) {
      console.warn('Could not update service worker:', e);
    }
  }
  return false;
}

/**
 * Production cache clear - clears all caches while preserving auth and critical data
 */
export async function productionCacheClear(): Promise<{
  localStorageCleared: number;
  swCachesCleared: number;
  swUpdated: boolean;
}> {
  // Step 1: Migrate legacy keys first
  migrateLegacyKeys();
  
  // Step 2: Clear orphaned localStorage data
  const localStorageCleared = clearOrphanedData();
  
  // Step 3: Clear session storage
  sessionStorage.clear();
  
  // Step 4: Clear service worker caches (except downloads)
  const swCachesCleared = await clearServiceWorkerCaches();
  
  // Step 5: Force service worker update
  const swUpdated = await forceServiceWorkerUpdate();
  
  return {
    localStorageCleared,
    swCachesCleared,
    swUpdated,
  };
}

/**
 * App version tracking for cache invalidation
 */
const APP_VERSION_KEY = 'hoyeeh-app-version';
const CURRENT_VERSION = '2.0.0'; // Increment this for each major release

export function checkAppVersion(): { isNew: boolean; previousVersion: string | null } {
  const previousVersion = localStorage.getItem(APP_VERSION_KEY);
  const isNew = previousVersion !== CURRENT_VERSION;
  
  if (isNew) {
    localStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
  }
  
  return { isNew, previousVersion };
}

/**
 * Run on app startup - clears stale caches on version update
 */
export async function initializeCacheManagement(): Promise<void> {
  const { isNew, previousVersion } = checkAppVersion();
  
  if (isNew && previousVersion) {
    console.log(`App updated from ${previousVersion} to ${CURRENT_VERSION}. Clearing caches...`);
    const result = await productionCacheClear();
    console.log('Cache cleared:', result);
  } else {
    // Just migrate legacy keys on normal startup
    migrateLegacyKeys();
  }
}
