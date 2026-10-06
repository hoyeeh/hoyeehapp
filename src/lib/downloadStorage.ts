// Netflix-style Download Storage with WebCrypto Encryption
// Stores encrypted video segments in IndexedDB for offline playback
// Supports partial downloads for true resume functionality

const DB_NAME = 'hoyeeh-offline-downloads';
const DB_VERSION = 3; // Bumped for new partial-downloads store
const STORE_SEGMENTS = 'encrypted-segments';
const STORE_METADATA = 'download-metadata';
const STORE_LICENSES = 'download-licenses';
const STORE_KEYS = 'device-keys';
const STORE_PARTIAL = 'partial-downloads'; // New store for resume support

export interface DownloadMetadata {
  id: string; // contentId or contentId_episodeId
  contentId: string;
  episodeId?: string;
  title: string;
  episodeTitle?: string;
  thumbnailUrl?: string;
  duration: number;
  quality: string;
  totalSize: number;
  downloadedSize: number;
  totalSegments: number;
  downloadedSegments: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'expired';
  progress: number;
  createdAt: number;
  updatedAt: number;
  lastWatchedPosition?: number;
  speed?: number; // bytes per second
  eta?: number; // estimated time remaining in seconds
  startedAt?: number; // timestamp when download started
  contentRating?: string; // For filtering kids content
  genre?: string;
  ageLimit?: number;
  videoUrl?: string; // Store URL for resume
}

export interface DownloadLicense {
  id: string;
  contentId: string;
  episodeId?: string;
  expiresAt: number;
  canPlayOffline: boolean;
  encryptedContentKey: string;
  lastVerified: number;
  /** Account+profile owner key (see offlineStorage.currentOwner). Licenses without it are not playable. */
  owner?: string;
}

export interface EncryptedSegment {
  contentId: string;
  segmentIndex: number;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  size: number;
}

// Partial download chunk for resume support
export interface PartialDownloadChunk {
  contentId: string;
  chunkIndex: number;
  data: ArrayBuffer;
  offset: number; // byte offset in the full file
  size: number;
}

// Initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Encrypted video segments store
      if (!db.objectStoreNames.contains(STORE_SEGMENTS)) {
        const segmentStore = db.createObjectStore(STORE_SEGMENTS, { keyPath: ['contentId', 'segmentIndex'] });
        segmentStore.createIndex('contentId', 'contentId', { unique: false });
      }

      // Download metadata store
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'id' });
      }

      // Download licenses store
      if (!db.objectStoreNames.contains(STORE_LICENSES)) {
        db.createObjectStore(STORE_LICENSES, { keyPath: 'id' });
      }

      // Device keys store
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS, { keyPath: 'id' });
      }

      // Partial downloads store for resume support
      if (!db.objectStoreNames.contains(STORE_PARTIAL)) {
        const partialStore = db.createObjectStore(STORE_PARTIAL, { keyPath: ['contentId', 'chunkIndex'] });
        partialStore.createIndex('contentId', 'contentId', { unique: false });
      }
    };
  });
}

// Generate or retrieve device key for encryption
export async function initDeviceKey(): Promise<CryptoKey> {
  const db = await openDB();

  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction(STORE_KEYS, 'readonly');
    const store = transaction.objectStore(STORE_KEYS);
    const request = store.get('device-key');

    request.onsuccess = async () => {
      if (request.result?.key) {
        // Import existing key
        try {
          const key = await crypto.subtle.importKey(
            'raw',
            request.result.key,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );
          resolve(key);
        } catch (err) {
          reject(err);
        }
      } else {
        // Generate new device key
        try {
          const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
          );

          // Export and store the key
          const exportedKey = await crypto.subtle.exportKey('raw', key);

          const writeTransaction = db.transaction(STORE_KEYS, 'readwrite');
          const writeStore = writeTransaction.objectStore(STORE_KEYS);
          writeStore.put({ id: 'device-key', key: exportedKey });

          resolve(key);
        } catch (err) {
          reject(err);
        }
      }
    };

    request.onerror = () => reject(request.error);
  });
}

// Encrypt a video segment using the device key
export async function encryptSegment(
  data: ArrayBuffer,
  deviceKey: CryptoKey
): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    deviceKey,
    data
  );
  return { iv, ciphertext };
}

// Decrypt a video segment
export async function decryptSegment(
  encryptedData: { iv: Uint8Array; ciphertext: ArrayBuffer },
  deviceKey: CryptoKey
): Promise<ArrayBuffer> {
  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
    deviceKey,
    encryptedData.ciphertext
  );
}

// Save an encrypted segment to IndexedDB
export async function saveSegment(
  contentId: string,
  segmentIndex: number,
  iv: Uint8Array,
  ciphertext: ArrayBuffer,
  size: number
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SEGMENTS, 'readwrite');
    const store = transaction.objectStore(STORE_SEGMENTS);

    const segment: EncryptedSegment = {
      contentId,
      segmentIndex,
      iv,
      ciphertext,
      size,
    };

    const request = store.put(segment);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Retrieve an encrypted segment
export async function getSegment(
  contentId: string,
  segmentIndex: number
): Promise<EncryptedSegment | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SEGMENTS, 'readonly');
    const store = transaction.objectStore(STORE_SEGMENTS);
    const request = store.get([contentId, segmentIndex]);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Get all segments for a content
export async function getAllSegments(contentId: string): Promise<EncryptedSegment[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SEGMENTS, 'readonly');
    const store = transaction.objectStore(STORE_SEGMENTS);
    const index = store.index('contentId');
    const request = index.getAll(contentId);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Save download metadata
export async function saveMetadata(metadata: DownloadMetadata): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_METADATA, 'readwrite');
    const store = transaction.objectStore(STORE_METADATA);
    const request = store.put(metadata);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get download metadata
export async function getMetadata(id: string): Promise<DownloadMetadata | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_METADATA, 'readonly');
    const store = transaction.objectStore(STORE_METADATA);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// List all downloads
export async function listDownloads(): Promise<DownloadMetadata[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_METADATA, 'readonly');
    const store = transaction.objectStore(STORE_METADATA);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Save download license
export async function saveLicense(license: DownloadLicense): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_LICENSES, 'readwrite');
    const store = transaction.objectStore(STORE_LICENSES);
    const request = store.put(license);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get download license
export async function getLicense(id: string): Promise<DownloadLicense | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_LICENSES, 'readonly');
    const store = transaction.objectStore(STORE_LICENSES);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Delete a download (segments, metadata, and license)
export async function deleteDownload(contentId: string): Promise<void> {
  const db = await openDB();

  // Delete all segments for this content
  const segmentTransaction = db.transaction(STORE_SEGMENTS, 'readwrite');
  const segmentStore = segmentTransaction.objectStore(STORE_SEGMENTS);
  const index = segmentStore.index('contentId');

  return new Promise((resolve, reject) => {
    const request = index.openCursor(contentId);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        // Delete metadata
        const metaTransaction = db.transaction(STORE_METADATA, 'readwrite');
        metaTransaction.objectStore(STORE_METADATA).delete(contentId);

        // Delete license
        const licenseTransaction = db.transaction(STORE_LICENSES, 'readwrite');
        licenseTransaction.objectStore(STORE_LICENSES).delete(contentId);

        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Clear all downloads (for logout)
export async function clearAllDownloads(): Promise<void> {
  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_SEGMENTS, STORE_METADATA, STORE_LICENSES], 'readwrite');
    transaction.objectStore(STORE_SEGMENTS).clear();
    transaction.objectStore(STORE_METADATA).clear();
    transaction.objectStore(STORE_LICENSES).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Delete device key (for logout/account change)
export async function deleteDeviceKey(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_KEYS, 'readwrite');
    const store = transaction.objectStore(STORE_KEYS);
    const request = store.delete('device-key');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get total storage used by downloads
export async function getStorageUsed(): Promise<number> {
  const downloads = await listDownloads();
  return downloads.reduce((total, d) => total + d.downloadedSize, 0);
}

// Check if a download exists and is complete
export async function isDownloadComplete(contentId: string): Promise<boolean> {
  const metadata = await getMetadata(contentId);
  return metadata?.status === 'completed';
}

// Check if license is valid
export async function isLicenseValid(contentId: string): Promise<boolean> {
  const license = await getLicense(contentId);
  if (!license) return false;
  return license.canPlayOffline && license.expiresAt > Date.now();
}

// Get download ID from content and episode
export function getDownloadId(contentId: string, episodeId?: string): string {
  return episodeId ? `${contentId}_${episodeId}` : contentId;
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ Partial Download Support for True Resume ============

// Save a partial download chunk
export async function savePartialChunk(
  contentId: string,
  chunkIndex: number,
  data: ArrayBuffer,
  offset: number
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PARTIAL, 'readwrite');
    const store = transaction.objectStore(STORE_PARTIAL);

    const chunk: PartialDownloadChunk = {
      contentId,
      chunkIndex,
      data,
      offset,
      size: data.byteLength,
    };

    const request = store.put(chunk);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get all partial chunks for a content
export async function getPartialChunks(contentId: string): Promise<PartialDownloadChunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PARTIAL, 'readonly');
    const store = transaction.objectStore(STORE_PARTIAL);
    const index = store.index('contentId');
    const request = index.getAll(contentId);

    request.onsuccess = () => {
      const chunks = (request.result || []) as PartialDownloadChunk[];
      // Sort by offset to ensure correct order
      chunks.sort((a, b) => a.offset - b.offset);
      resolve(chunks);
    };
    request.onerror = () => reject(request.error);
  });
}

// Get total downloaded bytes from partial chunks
export async function getPartialDownloadedSize(contentId: string): Promise<number> {
  const chunks = await getPartialChunks(contentId);
  return chunks.reduce((total, chunk) => total + chunk.size, 0);
}

// Delete partial chunks after successful download
export async function deletePartialChunks(contentId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_PARTIAL, 'readwrite');
    const store = transaction.objectStore(STORE_PARTIAL);
    const index = store.index('contentId');

    const request = index.openCursor(contentId);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Combine partial chunks into a single ArrayBuffer
export async function combinePartialChunks(contentId: string): Promise<ArrayBuffer | null> {
  const chunks = await getPartialChunks(contentId);
  if (chunks.length === 0) return null;

  const totalSize = chunks.reduce((sum, c) => sum + c.size, 0);
  const combined = new Uint8Array(totalSize);
  
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk.data), offset);
    offset += chunk.size;
  }

  return combined.buffer;
}
