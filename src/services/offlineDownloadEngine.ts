import {
  OFFLINE_EXPIRY_MS,
  currentOwner,
  downloadKey,
  getDownload,
  getManifest,
  getOwnerEpoch,
  looksLikeVideo,
  putChunk,
  putManifest,
  readChunk,
  removeChunks,
  removeManifest,
  type DownloadManifest,
} from "@/services/offlineStorage";

/**
 * Resumable, verified download-to-device.
 * Fetching is injected (`openRange`) so the engine can be tested with real
 * bytes and so production can go through the entitlement-checked proxy.
 */

export const CHUNK_SIZE = 4 * 1024 * 1024;

export class OfflineDownloadError extends Error {
  constructor(message: string, public code:
    | "UNSUPPORTED_SOURCE" | "QUOTA" | "INCOMPLETE" | "CORRUPT" | "HTTP" | "AUTH" | "RANGE") {
    super(message);
    this.name = "OfflineDownloadError";
  }
}

export type OpenRange = (start: number, signal: AbortSignal) => Promise<Response>;

export interface DownloadParams {
  contentId: string;
  episodeId?: string;
  meta: { title: string; poster?: string; duration?: number };
  openRange: OpenRange;
  signal?: AbortSignal;
  onProgress?: (received: number, total: number | null) => void;
  chunkSize?: number;
}

const inFlight = new Map<string, Promise<DownloadManifest>>();

function isQuota(e: unknown) {
  const n = (e as { name?: string })?.name;
  return n === "QuotaExceededError" || n === "NS_ERROR_DOM_QUOTA_REACHED" ||
    /quota/i.test(String((e as Error)?.message || ""));
}

function parseContentRange(v: string | null): { start: number; total: number | null } | null {
  const m = v?.match(/^bytes (\d+)-(\d+)\/(\d+|\*)$/);
  if (!m) return null;
  return { start: Number(m[1]), total: m[3] === "*" ? null : Number(m[3]) };
}

export async function downloadToDevice(p: DownloadParams): Promise<DownloadManifest> {
  const owner = await currentOwner();
  if (!owner) throw new OfflineDownloadError("Sign in required to download", "AUTH");
  const id = downloadKey(p.contentId, p.episodeId);
  const flightKey = `${owner}::${id}`; // never share a download across accounts/profiles
  const existing = inFlight.get(flightKey);
  if (existing) return existing; // de-duplicate concurrent taps in same page
  const run = runDownload(p, id, owner, getOwnerEpoch()).finally(() => inFlight.delete(flightKey));
  inFlight.set(flightKey, run);
  return run;
}

async function assertOwner(owner: string, epoch: number) {
  if (getOwnerEpoch() !== epoch || (await currentOwner()) !== owner) {
    throw new OfflineDownloadError("Signed out or switched profile during download", "AUTH");
  }
}

async function runDownload(p: DownloadParams, id: string, owner: string, epoch: number): Promise<DownloadManifest> {
  try {
    return await runDownloadInner(p, id, owner, epoch);
  } catch (e) {
    if (getOwnerEpoch() !== epoch || (await currentOwner()) !== owner) {
      // Owner went away mid-download: leave nothing behind for them.
      await removeChunks(owner, id).catch(() => {});
      await removeManifest(owner, id).catch(() => {});
      throw new OfflineDownloadError("Signed out or switched profile during download", "AUTH");
    }
    throw e;
  }
}

async function runDownloadInner(p: DownloadParams, id: string, owner: string, epoch: number): Promise<DownloadManifest> {
  const chunkSize = p.chunkSize ?? CHUNK_SIZE;
  const signal = p.signal ?? new AbortController().signal;
  const now = Date.now();

  let m = await getManifest(id, owner);
  if (m?.status === "complete") {
    // Only reuse a complete download that still verifies (unexpired, all bytes present).
    const ok = await getDownload(id);
    if (ok) return m;
    m = await getManifest(id, owner); // getDownload reset/removed it if invalid
    if (m?.status === "complete") m = null;
  }
  if (!m) {
    m = {
      contentId: p.contentId, episodeId: p.episodeId, owner, title: p.meta.title,
      poster: p.meta.poster, duration: p.meta.duration, savedAt: now, updatedAt: now,
      expiresAt: now + OFFLINE_EXPIRY_MS, status: "partial", totalBytes: null,
      receivedBytes: 0, chunkCount: 0, chunkSizes: [], mimeType: "video/mp4",
    };
  }

  const start = m.receivedBytes;
  let res = await p.openRange(start, signal);

  if (res.status === 416 && m.totalBytes !== null && start === m.totalBytes) {
    await res.body?.cancel();
  } else {
    if (res.status === 401 || res.status === 403) {
      await res.body?.cancel();
      throw new OfflineDownloadError("You are not allowed to download this title", "AUTH");
    }
    if (res.status === 415) {
      await res.body?.cancel();
      throw new OfflineDownloadError("This title is streaming-only and can't be saved for offline viewing yet.", "UNSUPPORTED_SOURCE");
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new OfflineDownloadError(`Download failed (HTTP ${res.status})`, "HTTP");
    }
    const ct = res.headers.get("content-type") || "";
    if (/mpegurl|dash\+xml|text\/html|application\/json/i.test(ct)) {
      await res.body?.cancel();
      throw new OfflineDownloadError("This title is streaming-only and can't be saved for offline viewing yet.", "UNSUPPORTED_SOURCE");
    }

    let total: number | null;
    if (start > 0 && res.status === 206) {
      const cr = parseContentRange(res.headers.get("content-range"));
      if (!cr || cr.start !== start || (m.totalBytes !== null && cr.total !== null && cr.total !== m.totalBytes)) {
        // Server returned the wrong range or the file changed: restart cleanly.
        await res.body?.cancel();
        await removeChunks(owner, id);
        m = { ...m, receivedBytes: 0, chunkCount: 0, chunkSizes: [], totalBytes: null };
        await putManifest(m);
        throw new OfflineDownloadError("Download source changed; please retry", "RANGE");
      }
      total = cr.total;
    } else {
      if (start > 0) {
        // Server ignored Range (200): discard partial bytes and start over.
        await removeChunks(owner, id);
        m = { ...m, receivedBytes: 0, chunkCount: 0, chunkSizes: [] };
      }
      const len = Number(res.headers.get("content-length"));
      total = Number.isFinite(len) && len > 0 ? len : null;
      if (res.status === 206) total = parseContentRange(res.headers.get("content-range"))?.total ?? total;
    }
    const etag = res.headers.get("etag");
    if (m.etag && etag && m.etag !== etag && m.receivedBytes > 0) {
      await res.body?.cancel();
      await removeChunks(owner, id);
      m = { ...m, receivedBytes: 0, chunkCount: 0, chunkSizes: [], etag: null };
      await putManifest(m);
      throw new OfflineDownloadError("Download source changed; please retry", "RANGE");
    }
    m = { ...m, totalBytes: total ?? m.totalBytes, etag: etag ?? m.etag ?? null, mimeType: ct.split(";")[0] || m.mimeType };

    // Quota pre-check (best-effort).
    try {
      const est = await navigator.storage?.estimate?.();
      if (est && m.totalBytes && est.quota !== undefined && est.usage !== undefined) {
        if (est.quota - est.usage < m.totalBytes - m.receivedBytes) {
          await res.body?.cancel();
          throw new OfflineDownloadError("Not enough storage on this device for this download", "QUOTA");
        }
      }
    } catch (e) {
      if (e instanceof OfflineDownloadError) throw e;
    }

    await streamInto(res, m, owner, id, chunkSize, p.onProgress, signal, epoch);
  }

  // Verify completeness and container.
  if (m.totalBytes !== null && m.receivedBytes !== m.totalBytes) {
    await putManifest(m);
    throw new OfflineDownloadError("Download was interrupted; tap retry to resume", "INCOMPLETE");
  }
  if (m.receivedBytes === 0) throw new OfflineDownloadError("Empty download", "CORRUPT");
  const head = await readChunk(owner, id, 0);
  if (!head || !(await looksLikeVideo(head))) {
    await removeChunks(owner, id);
    m = { ...m, receivedBytes: 0, chunkCount: 0, chunkSizes: [] };
    await putManifest(m);
    throw new OfflineDownloadError("Downloaded file is not a playable video", "CORRUPT");
  }
  await assertOwner(owner, epoch);
  m = { ...m, status: "complete", size: m.receivedBytes, totalBytes: m.receivedBytes, updatedAt: Date.now(), expiresAt: Date.now() + OFFLINE_EXPIRY_MS };
  await putManifest(m);
  return m;
}

async function streamInto(
  res: Response, m: DownloadManifest, owner: string, id: string, chunkSize: number,
  onProgress: DownloadParams["onProgress"], signal: AbortSignal, epoch: number,
) {
  if (!res.body) throw new OfflineDownloadError("Empty response", "HTTP");
  const reader = res.body.getReader();
  let buf: Uint8Array[] = [];
  let bufLen = 0;
  const flush = async () => {
    if (!bufLen) return;
    await assertOwner(owner, epoch);
    const blob = new Blob(buf as BlobPart[], { type: m.mimeType || "video/mp4" });
    try {
      await putChunk(owner, id, m.chunkCount, blob);
    } catch (e) {
      if (isQuota(e)) throw new OfflineDownloadError("Storage full. Delete some downloads and try again.", "QUOTA");
      throw e;
    }
    m.chunkSizes = [...m.chunkSizes, blob.size];
    m.chunkCount += 1;
    m.receivedBytes += blob.size;
    m.updatedAt = Date.now();
    await putManifest(m); // durable progress after every chunk
    buf = [];
    bufLen = 0;
    onProgress?.(m.receivedBytes, m.totalBytes);
  };
  try {
    for (;;) {
      if (signal.aborted) throw Object.assign(new Error("Aborted"), { name: "AbortError" });
      const { done, value } = await reader.read();
      if (done) break;
      if (m.totalBytes !== null && m.receivedBytes + bufLen + value.byteLength > m.totalBytes) {
        throw new OfflineDownloadError("Server sent more data than expected", "CORRUPT");
      }
      // Split large network reads so chunks stay bounded in memory/IndexedDB.
      let off = 0;
      while (off < value.byteLength) {
        const take = Math.min(chunkSize - bufLen, value.byteLength - off);
        buf.push(value.subarray(off, off + take));
        bufLen += take;
        off += take;
        if (bufLen >= chunkSize) await flush();
      }
    }
    await flush();
  } catch (e) {
    try { await reader.cancel(); } catch { /* ignore */ }
    // Keep already-flushed chunks for resume; drop the unflushed tail.
    if (getOwnerEpoch() === epoch) await putManifest(m).catch(() => {});
    throw e;
  }
}
