/**
 * Storage quota helpers for offline downloads.
 *
 * Mobile PWAs — especially Safari on iOS — silently fail writes once the
 * origin runs out of space. We use the Storage API to estimate available
 * room ahead of time and to translate `QuotaExceededError` into a clean
 * user-facing message.
 */

export interface StorageEstimateResult {
  usage: number;
  quota: number;
  available: number;
  supported: boolean;
}

const FALLBACK_QUOTA = 500 * 1024 * 1024; // 500MB assumed worst-case (iOS Safari)

export async function estimateStorage(): Promise<StorageEstimateResult> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return {
      usage: 0,
      quota: FALLBACK_QUOTA,
      available: FALLBACK_QUOTA,
      supported: false,
    };
  }
  try {
    const { usage = 0, quota = FALLBACK_QUOTA } = await navigator.storage.estimate();
    return {
      usage,
      quota,
      available: Math.max(0, quota - usage),
      supported: true,
    };
  } catch {
    return {
      usage: 0,
      quota: FALLBACK_QUOTA,
      available: FALLBACK_QUOTA,
      supported: false,
    };
  }
}

/**
 * Check whether the origin has at least `requiredBytes` of headroom. If the
 * size of the upcoming download is unknown, pass 0 — we still require a small
 * safety buffer so writes don't fail the moment they start.
 */
export async function hasSpaceFor(
  requiredBytes: number,
  bufferBytes: number = 50 * 1024 * 1024, // 50MB safety buffer
): Promise<{ ok: boolean; estimate: StorageEstimateResult }> {
  const estimate = await estimateStorage();
  // If the Storage API isn't supported we can't pre-check; let the actual
  // write attempt surface a QuotaExceededError on failure.
  if (!estimate.supported) return { ok: true, estimate };
  return {
    ok: estimate.available >= requiredBytes + bufferBytes,
    estimate,
  };
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number; message?: string };
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e.code === 22 ||
    e.code === 1014 ||
    /quota|storage.*full|out of space/i.test(e.message ?? "")
  );
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(0)} MB`;
}

/**
 * Ask the browser to persist storage (prevents eviction under disk pressure).
 * Safe to call multiple times — the browser shows the prompt at most once.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
