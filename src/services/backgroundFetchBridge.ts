/**
 * Background Fetch → IndexedDB bridge.
 *
 * The service worker writes completed Background Fetch responses into Cache
 * Storage at `/downloads/<downloadId>` (see `public/sw.js`). The rest of the
 * app reads downloads from IndexedDB (`offlineStorage`). Without a bridge,
 * those blobs would be orphaned in Cache Storage.
 *
 * This module:
 *   1. Scans the `hoyeeh-downloads` cache on app start.
 *   2. Listens for `BACKGROUND_DOWNLOAD_COMPLETE` SW messages.
 *   3. Moves each blob into IndexedDB via `saveDownload`, then deletes the
 *      cache entry to free quota.
 *
 * Download metadata (title, contentId, etc.) is read from
 * `hoyeeh-background-downloads` in `localStorage` — the same place
 * `useBackgroundDownload` persists its state.
 */

import { saveDownload } from "@/services/offlineStorage";
import { isQuotaExceededError } from "@/utils/storageQuota";

const CACHE_NAME = "hoyeeh-downloads";
const BG_STATE_KEY = "hoyeeh-background-downloads";

interface BackgroundEntryMeta {
  downloadId: string;
  contentId: string;
  episodeId?: string;
  title: string;
  totalSize?: number;
}

function loadBackgroundState(): Map<string, BackgroundEntryMeta> {
  try {
    const raw = localStorage.getItem(BG_STATE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Array<[string, BackgroundEntryMeta]>;
    return new Map(parsed);
  } catch {
    return new Map();
  }
}

async function migrateOne(downloadId: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const match = await cache.match(`/downloads/${downloadId}`);
    if (!match) return false;

    const blob = await match.blob();
    const meta = loadBackgroundState().get(downloadId);
    const contentId = meta?.contentId ?? downloadId;
    const title = meta?.title ?? "Offline download";

    await saveDownload(contentId, blob, {
      title,
      size: blob.size,
      mimeType: blob.type,
    });

    await cache.delete(`/downloads/${downloadId}`);
    // eslint-disable-next-line no-console
    console.log("[bgFetchBridge] migrated to IndexedDB:", downloadId);
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      // eslint-disable-next-line no-console
      console.error(
        "[bgFetchBridge] storage quota exceeded while migrating",
        downloadId,
      );
    } else {
      // eslint-disable-next-line no-console
      console.warn("[bgFetchBridge] migration failed", downloadId, err);
    }
    return false;
  }
}

/** Scan the cache and migrate any blobs left behind from prior sessions. */
export async function drainBackgroundFetchCache(): Promise<number> {
  if (typeof caches === "undefined") return 0;
  let migrated = 0;
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    for (const req of requests) {
      const url = new URL(req.url);
      const m = url.pathname.match(/^\/downloads\/(.+)$/);
      if (!m) continue;
      const ok = await migrateOne(m[1]);
      if (ok) migrated++;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[bgFetchBridge] drain failed", err);
  }
  return migrated;
}

let initialized = false;

/**
 * Initialize the bridge. Idempotent — safe to call from app startup.
 * Sets up the SW message listener and runs an initial drain.
 */
export function initBackgroundFetchBridge(): void {
  if (initialized) return;
  initialized = true;

  if (typeof navigator !== "undefined" && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const { type, payload } = (event.data as { type?: string; payload?: { downloadId?: string } }) || {};
      if (type === "BACKGROUND_DOWNLOAD_COMPLETE" && payload?.downloadId) {
        void migrateOne(payload.downloadId);
      }
    });
  }

  // Drain on startup (covers app launches that happened after a download
  // completed in the background while the tab was closed).
  void drainBackgroundFetchCache();
}
