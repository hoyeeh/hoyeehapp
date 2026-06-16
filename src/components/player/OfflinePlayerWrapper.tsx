import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { getDownload } from "@/services/offlineStorage";

export interface OfflinePlayerWrapperProps {
  contentId: string;
  /** Network/CDN URL used when offline copy is absent or `isOffline` is false. */
  networkSrc: string;
  /** When true, attempt to resolve a locally stored blob first. */
  isOffline: boolean;
  /**
   * Render function that receives the resolved playable `src` and returns the
   * underlying player. Keeps this wrapper completely transparent to player
   * internals (VideoJS, legacy, Party Watch, gestures, etc).
   */
  children: (resolvedSrc: string) => ReactNode;
}

/**
 * Transparent bridge that resolves a playable `src` for the existing player
 * components. If `isOffline` is true and a local blob is available, it returns
 * a `blob:` URL; otherwise it falls back to `networkSrc`.
 *
 * Does NOT touch player internals. Memory-safe: revokes any blob URL on unmount
 * or when the resolved source changes.
 */
export const OfflinePlayerWrapper = ({
  contentId,
  networkSrc,
  isOffline,
  children,
}: OfflinePlayerWrapperProps) => {
  const [localSrc, setLocalSrc] = useState<string | null>(
    isOffline ? null : networkSrc,
  );
  const [isLoading, setIsLoading] = useState<boolean>(isOffline);
  const createdBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cleanupBlob = () => {
      if (
        createdBlobUrlRef.current &&
        createdBlobUrlRef.current.startsWith("blob:")
      ) {
        URL.revokeObjectURL(createdBlobUrlRef.current);
        createdBlobUrlRef.current = null;
      }
    };

    if (!isOffline) {
      cleanupBlob();
      setLocalSrc(networkSrc);
      setIsLoading(false);
      return () => {
        cancelled = true;
        cleanupBlob();
      };
    }

    setIsLoading(true);
    setLocalSrc(null);

    (async () => {
      try {
        const stored = await getDownload(contentId);
        if (cancelled) return;
        if (stored?.blob) {
          const blobUrl = URL.createObjectURL(stored.blob);
          createdBlobUrlRef.current = blobUrl;
          setLocalSrc(blobUrl);
        } else {
          // Missing / deleted / corrupted — safe network fallback.
          setLocalSrc(networkSrc);
        }
      } catch {
        if (!cancelled) setLocalSrc(networkSrc);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      cleanupBlob();
    };
  }, [contentId, isOffline, networkSrc]);

  if (isOffline && isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[200px] bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white/80" />
      </div>
    );
  }

  if (!localSrc) return null;

  return <>{children(localSrc)}</>;
};

export default OfflinePlayerWrapper;
