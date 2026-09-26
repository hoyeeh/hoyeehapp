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
  getMetadata as getLegacyMetadata,
  getSegment,
  initDeviceKey,
  listDownloads as listLegacyDownloads,
  type DownloadMetadata as LegacyDownloadMetadata,
} from "@/lib/downloadStorage";
import {
  getAllDownloads as getAllNewDownloads,
  getDownload as getNewDownload,
  downloadKey,
  currentOwner,
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

/**
 * A legacy license is usable only by the account+profile that created it and
 * only until it expires. Licenses from before owner-binding are refused.
 */
export function legacyLicenseUsable(
  license: { owner?: string; expiresAt?: number } | null | undefined,
  owner: string | null,
  now = Date.now(),
): boolean {
  if (!license || !owner) return false;
  if (!license.owner || license.owner !== owner) return false;
  if (!license.expiresAt || license.expiresAt < now) return false;
  return true;
}

/** Try the legacy (license-gated) store first. */
async function resolveLegacy(
  contentId: string,
  episodeId?: string,
): Promise<string | null> {
  try {
    const downloadId = getDownloadId(contentId, episodeId);
    const license = await getLicense(downloadId);
    if (!legacyLicenseUsable(license, await currentOwner())) return null;
    const meta = await getLegacyMetadata(downloadId);
    if (!meta || meta.status !== "completed") return null;

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

/** Fall back to the lightweight store (owner-scoped + verified inside getDownload). */
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
  // Owner-scoped, byte-verified store first; legacy only with an owner-bound,
  // unexpired license AND completed metadata (fails closed otherwise).
  const fresh = await resolveNew(contentId, episodeId);
  if (fresh) return fresh;
  return resolveLegacy(contentId, episodeId);
}

/** Check whether a given content/episode is available offline in any store. */
export async function hasUnifiedDownload(
  contentId: string,
  episodeId?: string,
): Promise<boolean> {
  try {
    const downloadId = getDownloadId(contentId, episodeId);
    const license = await getLicense(downloadId);
    if (legacyLicenseUsable(license, await currentOwner())) {
      const seg = await getSegment(downloadId, 0);
      if (seg) return true;
    }
  } catch {
    /* ignore */
  }
  const rec = await getNewDownload(downloadKey(contentId, episodeId)).catch(() => null);
  return !!rec?.blob;
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
  const owner = await currentOwner();
  const completedLegacy: UnifiedDownload[] = [];
  for (const d of legacy) {
    if (d.status !== "completed") continue;
    const lic = await getLicense(d.id).catch(() => null);
    if (legacyLicenseUsable(lic, owner)) completedLegacy.push(mapLegacy(d));
  }
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
