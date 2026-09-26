/**
 * Unified offline-video resolver.
 *
 * The app has two parallel offline-storage systems:
 *  - NEW lightweight system: `src/services/offlineStorage.ts`
 *    (plain Blob + metadata, used by `useVideoDownloader`).
 *  - LEGACY canonical system: `src/lib/downloadStorage.ts`
 *    (license-gated, AES-encrypted segments, used by `useDownloadManager`).
 *
 * Per consolidation decision, LEGACY is canonical. This module gives the
 * rest of the app a single place to:
 *   1. Resolve a playable local URL for a given (contentId, episodeId).
 *   2. Enumerate all locally-available downloads regardless of system.
 *
 * Resolution order: legacy (DRM-safe) first, then new store.
 *
 * IMPORTANT: any blob URL returned by `resolveOfflineSrc` is owned by the
 * caller and MUST be revoked via `URL.revokeObjectURL` when no longer needed.
 */

import {
  decryptSegment,
  getDownloadId,
  getLicense,
  getSegment,
  initDeviceKey,
  listDownloads as listLegacyDownloads,
  type DownloadMetadata as LegacyDownloadMetadata,
} from "@/lib/downloadStorage";
import {
  getAllDownloads as getAllNewDownloads,
  getDownload as getNewDownload,
  downloadKey,
  type DownloadMetadata as NewDownloadMetadata,
} from "@/services/offlineStorage";

export interface UnifiedDownload {
  source: "legacy" | "new";
  contentId: string;
  episodeId?: string;
  title: string;
  episodeTitle?: string;
  thumbnailUrl?: string;
  duration?: number;
  size?: number;
  createdAt: number;
}

let cachedDeviceKey: CryptoKey | null = null;

async function getDeviceKey(): Promise<CryptoKey> {
  if (!cachedDeviceKey) {
    cachedDeviceKey = await initDeviceKey();
  }
  return cachedDeviceKey;
}

/** Try the legacy (license-gated) store first. */
async function resolveLegacy(
  contentId: string,
  episodeId?: string,
): Promise<string | null> {
  try {
    const downloadId = getDownloadId(contentId, episodeId);
    const license = await getLicense(downloadId);
    if (!license) return null;
    if (license.expiresAt && license.expiresAt < Date.now()) return null;

    const segment = await getSegment(downloadId, 0);
    if (!segment) return null;

    const key = await getDeviceKey();
    const decrypted = await decryptSegment(
      { iv: segment.iv, ciphertext: segment.ciphertext },
      key,
    );
    const blob = new Blob([decrypted], { type: "video/mp4" });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn("[unifiedOfflineVideo] legacy resolve failed", err);
    return null;
  }
}

/** Fall back to the lightweight new store. */
async function resolveNew(contentId: string, episodeId?: string): Promise<string | null> {
  try {
    const rec = await getNewDownload(downloadKey(contentId, episodeId));
    if (!rec?.blob) return null;
    return URL.createObjectURL(rec.blob);
  } catch (err) {
    console.warn("[unifiedOfflineVideo] new resolve failed", err);
    return null;
  }
}

/**
 * Resolve a locally-stored video to a blob URL.
 * Caller owns the returned URL — revoke it with `URL.revokeObjectURL`.
 */
export async function resolveOfflineSrc(
  contentId: string,
  episodeId?: string,
): Promise<string | null> {
  const legacy = await resolveLegacy(contentId, episodeId);
  if (legacy) return legacy;
  return resolveNew(contentId, episodeId);
}

/** Check whether a given content/episode is available offline in any store. */
export async function hasUnifiedDownload(
  contentId: string,
  episodeId?: string,
): Promise<boolean> {
  try {
    const downloadId = getDownloadId(contentId, episodeId);
    const license = await getLicense(downloadId);
    if (license && (!license.expiresAt || license.expiresAt >= Date.now())) {
      const seg = await getSegment(downloadId, 0);
      if (seg) return true;
    }
  } catch {
    /* ignore */
  }
  const { hasDownload } = await import("@/services/offlineStorage");
  return hasDownload(downloadKey(contentId, episodeId));
}

function mapLegacy(d: LegacyDownloadMetadata): UnifiedDownload {
  return {
    source: "legacy",
    contentId: d.contentId,
    episodeId: d.episodeId,
    title: d.title,
    episodeTitle: d.episodeTitle,
    thumbnailUrl: d.thumbnailUrl,
    duration: d.duration,
    size: d.downloadedSize,
    createdAt: d.createdAt,
  };
}

function mapNew(d: NewDownloadMetadata): UnifiedDownload {
  return {
    source: "new",
    contentId: d.contentId,
    episodeId: d.episodeId,
    title: d.title,
    thumbnailUrl: (d.poster as string | undefined) ?? undefined,
    duration: d.duration,
    size: d.size,
    createdAt: d.savedAt,
  };
}

/** Merged list of all locally-available downloads (legacy + new). */
export async function listUnifiedDownloads(): Promise<UnifiedDownload[]> {
  const [legacy, fresh] = await Promise.all([
    listLegacyDownloads().catch(() => [] as LegacyDownloadMetadata[]),
    getAllNewDownloads().catch(() => [] as NewDownloadMetadata[]),
  ]);
  const completedLegacy = legacy
    .filter((d) => d.status === "completed")
    .map(mapLegacy);
  // De-dupe: legacy wins over new for the same contentId/episodeId pair.
  const seen = new Set(
    completedLegacy.map((d) => `${d.contentId}:${d.episodeId ?? ""}`),
  );
  const newOnly = fresh
    .map(mapNew)
    .filter((d) => !seen.has(`${d.contentId}:${d.episodeId ?? ""}`));
  return [...completedLegacy, ...newOnly].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}
