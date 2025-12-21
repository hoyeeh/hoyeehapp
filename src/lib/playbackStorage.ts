/**
 * IndexedDB-based persistent playback position storage
 * Stores watch progress locally for offline continuity across app restarts
 */

const DB_NAME = 'hoyeeh_playback';
const DB_VERSION = 1;
const STORE_NAME = 'playback_positions';

interface PlaybackPosition {
  id: string; // contentId or episodeId
  contentId: string;
  episodeId?: string;
  position: number;
  duration: number;
  updatedAt: number;
  title?: string;
  thumbnail?: string;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[PlaybackStorage] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('contentId', 'contentId', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

/**
 * Save playback position to IndexedDB
 */
export async function savePlaybackPosition(
  contentId: string,
  position: number,
  duration: number,
  options?: {
    episodeId?: string;
    title?: string;
    thumbnail?: string;
  }
): Promise<void> {
  try {
    const db = await initDB();
    const id = options?.episodeId || contentId;
    
    const playbackData: PlaybackPosition = {
      id,
      contentId,
      episodeId: options?.episodeId,
      position,
      duration,
      updatedAt: Date.now(),
      title: options?.title,
      thumbnail: options?.thumbnail,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(playbackData);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[PlaybackStorage] Failed to save position:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[PlaybackStorage] Save error:', error);
  }
}

/**
 * Get playback position from IndexedDB
 */
export async function getPlaybackPosition(
  contentId: string,
  episodeId?: string
): Promise<PlaybackPosition | null> {
  try {
    const db = await initDB();
    const id = episodeId || contentId;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        console.error('[PlaybackStorage] Failed to get position:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[PlaybackStorage] Get error:', error);
    return null;
  }
}

/**
 * Get all playback positions (for continue watching)
 */
export async function getAllPlaybackPositions(): Promise<PlaybackPosition[]> {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('updatedAt');
      const request = index.openCursor(null, 'prev'); // Most recent first

      const results: PlaybackPosition[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => {
        console.error('[PlaybackStorage] Failed to get all positions:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[PlaybackStorage] Get all error:', error);
    return [];
  }
}

/**
 * Delete a playback position
 */
export async function deletePlaybackPosition(
  contentId: string,
  episodeId?: string
): Promise<void> {
  try {
    const db = await initDB();
    const id = episodeId || contentId;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[PlaybackStorage] Failed to delete position:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[PlaybackStorage] Delete error:', error);
  }
}

/**
 * Clear old playback positions (older than 30 days)
 */
export async function clearOldPlaybackPositions(): Promise<void> {
  try {
    const db = await initDB();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('updatedAt');
      const range = IDBKeyRange.upperBound(thirtyDaysAgo);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        console.error('[PlaybackStorage] Failed to clear old positions:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[PlaybackStorage] Clear old error:', error);
  }
}

/**
 * Get positions for a specific content (all episodes)
 */
export async function getContentPositions(contentId: string): Promise<PlaybackPosition[]> {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('contentId');
      const request = index.getAll(contentId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('[PlaybackStorage] Failed to get content positions:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[PlaybackStorage] Get content positions error:', error);
    return [];
  }
}
