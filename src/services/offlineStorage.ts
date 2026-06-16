import localforage from "localforage";

export interface DownloadMetadata {
  contentId: string;
  title: string;
  poster?: string;
  duration?: number;
  size?: number;
  mimeType?: string;
  savedAt: number;
  [key: string]: unknown;
}

export interface StoredDownload {
  blob: Blob;
  metadata: DownloadMetadata;
}

interface StoredRecord {
  blob: Blob;
  metadata: DownloadMetadata;
}

export const offlineDB = localforage.createInstance({
  name: "StreamingApp",
  storeName: "offline_videos",
  description: "Offline video downloads (non-DRM only)",
});

const db = offlineDB;

/** Save a video blob and its metadata under `contentId`. */
export async function saveDownload(
  contentId: string,
  blob: Blob,
  metadata: Partial<DownloadMetadata> & { title: string },
): Promise<DownloadMetadata> {
  const fullMeta: DownloadMetadata = {
    contentId,
    savedAt: Date.now(),
    size: blob.size,
    mimeType: blob.type,
    ...metadata,
  };
  const record: StoredRecord = { blob, metadata: fullMeta };
  await db.setItem(contentId, record);
  return fullMeta;
}

/** Retrieve a stored download, or null if not present. */
export async function getDownload(
  contentId: string,
): Promise<StoredDownload | null> {
  const record = await db.getItem<StoredRecord>(contentId);
  if (!record || !record.blob) return null;
  return { blob: record.blob, metadata: record.metadata };
}

/** Return all stored downloads' metadata for list rendering. */
export async function getAllDownloads(): Promise<DownloadMetadata[]> {
  const items: DownloadMetadata[] = [];
  await db.iterate<StoredRecord, void>((record) => {
    if (record?.metadata) items.push(record.metadata);
  });
  return items.sort((a, b) => b.savedAt - a.savedAt);
}

/** Delete a single stored download. */
export async function deleteDownload(contentId: string): Promise<void> {
  await db.removeItem(contentId);
}

/** Quick existence check without loading the blob into memory unnecessarily. */
export async function hasDownload(contentId: string): Promise<boolean> {
  const keys = await db.keys();
  return keys.includes(contentId);
}
