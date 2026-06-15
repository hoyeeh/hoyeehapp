import localforage from "localforage";

/**
 * Isolated offline video storage for NON-DRM content only.
 * Uses a dedicated IndexedDB store. No dependency on player components.
 */

export interface OfflineVideoMetadata {
  contentId: string;
  title: string;
  poster: string;
  duration: number;
  size: number;
  mimeType: string;
  savedAt: number;
}

interface StoredEntry {
  blob: Blob;
  metadata: OfflineVideoMetadata;
}

const STORE_NAME = "offline_videos";

const store = localforage.createInstance({
  name: "hoyeeh_offline",
  storeName: STORE_NAME,
  description: "Offline non-DRM video blobs and metadata",
});

// Track active object URLs so we can revoke them on delete
const activeObjectUrls = new Map<string, string>();

export async function saveVideo(
  contentId: string,
  blob: Blob,
  metadata: { title: string; poster: string; duration: number }
): Promise<OfflineVideoMetadata> {
  const fullMeta: OfflineVideoMetadata = {
    contentId,
    title: metadata.title,
    poster: metadata.poster,
    duration: metadata.duration,
    size: blob.size,
    mimeType: blob.type || "video/mp4",
    savedAt: Date.now(),
  };
  const entry: StoredEntry = { blob, metadata: fullMeta };
  await store.setItem(contentId, entry);
  return fullMeta;
}

export async function getVideo(
  contentId: string
): Promise<{ blob: Blob; metadata: OfflineVideoMetadata } | null> {
  const entry = await store.getItem<StoredEntry>(contentId);
  if (!entry) return null;
  return entry;
}

export async function getAllDownloads(): Promise<OfflineVideoMetadata[]> {
  const list: OfflineVideoMetadata[] = [];
  await store.iterate<StoredEntry, void>((value) => {
    if (value?.metadata) list.push(value.metadata);
  });
  return list.sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteVideo(contentId: string): Promise<void> {
  const url = activeObjectUrls.get(contentId);
  if (url) {
    try { URL.revokeObjectURL(url); } catch { /* noop */ }
    activeObjectUrls.delete(contentId);
  }
  await store.removeItem(contentId);
}

export async function hasVideo(contentId: string): Promise<boolean> {
  const keys = await store.keys();
  return keys.includes(contentId);
}

/** Create (and track) an object URL for a stored blob. */
export function trackObjectUrl(contentId: string, url: string): void {
  const prev = activeObjectUrls.get(contentId);
  if (prev && prev !== url) {
    try { URL.revokeObjectURL(prev); } catch { /* noop */ }
  }
  activeObjectUrls.set(contentId, url);
}

export function revokeObjectUrl(contentId: string): void {
  const url = activeObjectUrls.get(contentId);
  if (url) {
    try { URL.revokeObjectURL(url); } catch { /* noop */ }
    activeObjectUrls.delete(contentId);
  }
}
