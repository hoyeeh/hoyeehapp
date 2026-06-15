import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { getVideo, trackObjectUrl } from "@/services/offlineVideoStorage";

interface OfflinePlayerWrapperProps {
  contentId: string;
  networkSrc: string;
  poster?: string;
  title?: string;
  isOffline: boolean;
  /** Safety: if true, offline mode is ignored and network src is used. */
  isPremium?: boolean;
  requiresDrm?: boolean;
  isPaid?: boolean;
  children: (resolvedSrc: string, isOfflineActive: boolean) => ReactNode;
}

/**
 * Transparent data provider that resolves the player's `src` to either:
 *   - a local IndexedDB blob URL (when `isOffline` is true AND a non-DRM
 *     download exists for `contentId`), or
 *   - the original `networkSrc` (default / fallback).
 *
 * SAFETY: DRM / premium / paid content ALWAYS falls back to `networkSrc`,
 * even if `isOffline=true`, because the offline store only holds non-DRM
 * blobs. The wrapper never touches Party Watch, Casting, Mobile Gestures,
 * or Mini-Player handoff — it only swaps the underlying `src` string.
 */
export const OfflinePlayerWrapper = ({
  contentId,
  networkSrc,
  isOffline,
  isPremium,
  requiresDrm,
  isPaid,
  children,
}: OfflinePlayerWrapperProps) => {
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(isOffline);
  const [error, setError] = useState<string | null>(null);

  const drmLocked = !!(isPremium || requiresDrm || isPaid);
  const shouldUseOffline = isOffline && !drmLocked;

  useEffect(() => {
    if (!shouldUseOffline) {
      setLocalSrc(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const entry = await getVideo(contentId);
        if (cancelled) return;
        if (entry) {
          const url = URL.createObjectURL(entry.blob);
          createdUrl = url;
          trackObjectUrl(contentId, url);
          setLocalSrc(url);
        } else {
          // No download (deleted / corrupted) — fall back to network.
          setLocalSrc(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load offline copy");
          setLocalSrc(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) {
        // CRITICAL: revoke to prevent memory leaks on unmount / src change.
        try { URL.revokeObjectURL(createdUrl); } catch { /* noop */ }
      }
    };
  }, [contentId, shouldUseOffline]);

  // Subtle overlay while we look up the offline blob, so the underlying
  // player never initializes with an empty src.
  if (shouldUseOffline && loading) {
    return (
      <div className="relative w-full aspect-video flex items-center justify-center bg-background/60">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const resolved = shouldUseOffline && localSrc ? localSrc : networkSrc;
  const offlineActive = shouldUseOffline && !!localSrc && !error;
  return <>{children(resolved, offlineActive)}</>;
};

export default OfflinePlayerWrapper;
