import { useEffect, useState, type ReactNode } from "react";
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
 * Bridges offline IndexedDB blobs to existing player components without
 * touching DRM playback paths. If the content is DRM/premium/paid, the
 * wrapper ALWAYS falls back to networkSrc, even if isOffline=true.
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

  const drmLocked = !!(isPremium || requiresDrm || isPaid);
  const shouldUseOffline = isOffline && !drmLocked;

  useEffect(() => {
    if (!shouldUseOffline) {
      setLocalSrc(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);

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
          setLocalSrc(null);
        }
      } catch {
        if (!cancelled) setLocalSrc(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) {
        // CRITICAL: revoke to prevent memory leaks
        try { URL.revokeObjectURL(createdUrl); } catch { /* noop */ }
      }
    };
  }, [contentId, shouldUseOffline]);

  if (shouldUseOffline && loading) return null;

  const resolved = shouldUseOffline && localSrc ? localSrc : networkSrc;
  return <>{children(resolved, shouldUseOffline && !!localSrc)}</>;
};

export default OfflinePlayerWrapper;
