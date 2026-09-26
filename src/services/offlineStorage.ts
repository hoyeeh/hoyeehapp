import localforage from "localforage";

/**
 * On-device offline video storage (non-DRM titles only).
 *
 * - Bytes are stored as chunk Blobs in IndexedDB; a manifest tracks durable
 *   progress so interrupted downloads can resume with HTTP Range.
 * - Everything is scoped to the signed-in account + active profile.
 * - Only `status: "complete"` + verified + unexpired downloads are playable.
 * - No media URL (signed or otherwise) is ever persisted.
 */

export const OFFLINE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

export interface DownloadMetadata {
  contentId: string;
  episodeId?: string;
  title: string;
  poster?: string;
  duration?: number;
  size?: number;
  mimeType?: string;
  savedAt: number;
  [key: string]: unknown;
}

export interface DownloadManifest extends DownloadMetadata {
  owner: string;
  status: "partial" | "complete";
  totalBytes: number | null;
  receivedBytes: number;
  chunkCount: number;
  chunkSizes: number[];
  etag?: string | null;
  expiresAt: number;
  updatedAt: number;
}

export interface StoredDownload {
  blob: Blob;
  metadata: DownloadMetadata;
}

export interface KVStore {
  getItem<T>(k: string): Promise<T | null>;
  setItem<T>(k: string, v: T): Promise<T>;
  removeItem(k: string): Promise<void>;
  keys(): Promise<string[]>;
}

let db: KVStore = localforage.createInstance({
  name: "StreamingApp",
  storeName: "offline_videos_v2",
  description: "Offline video downloads (non-DRM only)",
});
export const offlineDB = db;

type OwnerProvider = () => Promise<string | null>;
const PROFILE_KEY = "hoyeeh_current_profile";
/**
 * Identify the owner from the locally persisted session WITHOUT a network
 * refresh, so an airplane-mode cold start after access-token expiry still
 * finds this account's downloads. Signing out removes the stored session.
 */
export function readCachedUserId(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^sb-[a-z0-9]+-auth-token$/.test(k)) continue;
      const v = JSON.parse(localStorage.getItem(k) || "null");
      const id = v?.user?.id ?? v?.currentSession?.user?.id;
      if (typeof id === "string" && id) return id;
    }
  } catch { /* ignore */ }
  return null;
}

let ownerProvider: OwnerProvider = async () => {
  let uid = readCachedUserId();
  if (!uid) {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    uid = data.session?.user?.id ?? null;
  }
  if (!uid) return null;
  let profile = "default";
  try { profile = localStorage.getItem(PROFILE_KEY) || "default"; } catch { /* ignore */ }
  return `${uid}|${profile}`;
};

/**
 * Owner epoch: bumped on logout / profile switch. In-flight downloads capture
 * the epoch at start and refuse to write once it changes, so a cleared store
 * can't be repopulated. Players listen for the event and stop playback.
 */
let ownerEpoch = 0;
export const OWNER_CHANGE_EVENT = "hoyeeh-offline-owner-change";
export function getOwnerEpoch() { return ownerEpoch; }
export function invalidateOfflineOwner() {
  ownerEpoch++;
  try { window.dispatchEvent(new Event(OWNER_CHANGE_EVENT)); } catch { /* non-browser */ }
}

/** Test hooks. */
export function __setOfflineStoreForTests(store: KVStore, owner: OwnerProvider) {
  db = store;
  ownerProvider = owner;
}

export async function currentOwner(): Promise<string | null> {
  return ownerProvider();
}

const mKey = (owner: string, id: string) => `m:${owner}:${id}`;
const cKey = (owner: string, id: string, i: number) => `c:${owner}:${id}:${i}`;
export const downloadKey = (contentId: string, episodeId?: string) =>
  episodeId ? `${contentId}__${episodeId}` : contentId;

export async function getManifest(id: string, owner?: string | null): Promise<DownloadManifest | null> {
  const o = owner ?? (await currentOwner());
  if (!o) return null;
  return db.getItem<DownloadManifest>(mKey(o, id));
}

export async function putManifest(m: DownloadManifest): Promise<void> {
  await db.setItem(mKey(m.owner, downloadKey(m.contentId, m.episodeId)), m);
}

export async function putChunk(owner: string, id: string, index: number, blob: Blob) {
  await db.setItem(cKey(owner, id, index), blob);
}

export async function readChunk(owner: string, id: string, index: number): Promise<Blob | null> {
  return db.getItem<Blob>(cKey(owner, id, index));
}

export async function removeChunks(owner: string, id: string, from = 0, to?: number) {
  const prefix = `c:${owner}:${id}:`;
  for (const k of await db.keys()) {
    if (!k.startsWith(prefix)) continue;
    const i = Number(k.slice(prefix.length));
    if (i >= from && (to === undefined || i < to)) await db.removeItem(k);
  }
}

/** Checks the container signature so an HTML error page or manifest is never treated as a video. */
export async function looksLikeVideo(head: Blob): Promise<boolean> {
  const buf = new Uint8Array(await readBlob(head.slice(0, 16)));
  if (buf.length < 12) return false;
  const ftyp = String.fromCharCode(buf[4], buf[5], buf[6], buf[7]) === "ftyp"; // MP4/MOV/M4V
  const webm = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
  return ftyp || webm;
}

function readBlob(b: Blob): Promise<ArrayBuffer> {
  if (typeof (b as Blob).arrayBuffer === "function") return b.arrayBuffer();
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as ArrayBuffer);
    r.onerror = () => rej(r.error);
    r.readAsArrayBuffer(b);
  });
}

/** Assemble and verify a complete download. Returns null for partial/corrupt/expired. */
export async function getDownload(id: string): Promise<StoredDownload | null> {
  const owner = await currentOwner();
  if (!owner) return null;
  const m = await getManifest(id, owner);
  if (!m || m.status !== "complete") return null;
  if (m.expiresAt < Date.now()) {
    await deleteDownload(id);
    return null;
  }
  const parts: Blob[] = [];
  let total = 0;
  for (let i = 0; i < m.chunkCount; i++) {
    const c = await db.getItem<Blob>(cKey(owner, id, i));
    if (!c || c.size !== m.chunkSizes[i]) {
      // Evicted or corrupted: never hand a truncated file to the player.
      await putManifest({ ...m, status: "partial", receivedBytes: 0, chunkCount: 0, chunkSizes: [], updatedAt: Date.now() });
      await removeChunks(owner, id);
      return null;
    }
    parts.push(c);
    total += c.size;
  }
  if (total !== m.receivedBytes || (m.totalBytes !== null && total !== m.totalBytes)) return null;
  const blob = new Blob(parts, { type: m.mimeType || "video/mp4" });
  return { blob, metadata: m };
}

/** Store an already-complete blob (used by the background-fetch bridge). */
export async function saveDownload(
  contentId: string,
  blob: Blob,
  metadata: Partial<DownloadMetadata> & { title: string },
): Promise<DownloadMetadata> {
  const owner = await currentOwner();
  if (!owner) throw new Error("Sign in required to save downloads");
  if (!(await looksLikeVideo(blob))) throw new Error("Downloaded file is not a playable video");
  const id = downloadKey(contentId, metadata.episodeId);
  await removeChunks(owner, id);
  await putChunk(owner, id, 0, blob);
  const now = Date.now();
  const m: DownloadManifest = {
    ...metadata,
    contentId,
    owner,
    title: metadata.title,
    mimeType: blob.type || "video/mp4",
    size: blob.size,
    savedAt: now,
    updatedAt: now,
    expiresAt: now + OFFLINE_EXPIRY_MS,
    status: "complete",
    totalBytes: blob.size,
    receivedBytes: blob.size,
    chunkCount: 1,
    chunkSizes: [blob.size],
  };
  await putManifest(m);
  return m;
}

export async function getAllDownloads(): Promise<DownloadMetadata[]> {
  const owner = await currentOwner();
  if (!owner) return [];
  const prefix = `m:${owner}:`;
  const out: DownloadMetadata[] = [];
  for (const k of await db.keys()) {
    if (!k.startsWith(prefix)) continue;
    const m = await db.getItem<DownloadManifest>(k);
    if (m && m.status === "complete" && m.expiresAt > Date.now()) out.push(m);
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteDownload(id: string): Promise<void> {
  const owner = await currentOwner();
  if (!owner) return;
  await removeChunks(owner, id);
  await db.removeItem(mKey(owner, id));
}

export async function hasDownload(id: string): Promise<boolean> {
  const m = await getManifest(id);
  return !!m && m.status === "complete" && m.expiresAt > Date.now();
}

/** Remove every download belonging to a user (all profiles) — used on logout. */
export async function purgeUserDownloads(userId: string): Promise<number> {
  let n = 0;
  for (const k of await db.keys()) {
    if (k.startsWith(`m:${userId}|`) || k.startsWith(`c:${userId}|`)) {
      await db.removeItem(k);
      n++;
    }
  }
  return n;
}

export async function purgeExpired(): Promise<void> {
  const now = Date.now();
  for (const k of await db.keys()) {
    if (!k.startsWith("m:")) continue;
    const m = await db.getItem<DownloadManifest>(k);
    if (m && m.expiresAt < now) {
      await removeChunks(m.owner, downloadKey(m.contentId, m.episodeId));
      await db.removeItem(k);
    }
  }
}
