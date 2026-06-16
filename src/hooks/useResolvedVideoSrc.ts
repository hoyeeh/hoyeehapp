import { useEffect, useRef, useState } from "react";
import { resolveOfflineSrc } from "@/services/unifiedOfflineVideo";

/**
 * Returns a playable `src` for the given content. If a local download exists
 * (either in the new or legacy offline store), a blob URL is returned and the
 * network URL is bypassed. Otherwise the original `networkSrc` is returned.
 *
 * The hook owns the blob URL lifecycle — it is revoked on unmount or when
 * inputs change, preventing memory leaks on mobile PWAs.
 */
export function useResolvedVideoSrc(
  contentId: string | undefined,
  episodeId: string | undefined,
  networkSrc: string,
): { src: string; isResolving: boolean; isOffline: boolean } {
  const [src, setSrc] = useState<string>(networkSrc);
  const [isResolving, setIsResolving] = useState<boolean>(Boolean(contentId));
  const [isOffline, setIsOffline] = useState(false);
  const createdUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsResolving(Boolean(contentId));
    setIsOffline(false);

    // Revoke any prior blob URL we created.
    if (createdUrlRef.current) {
      URL.revokeObjectURL(createdUrlRef.current);
      createdUrlRef.current = null;
    }

    if (!contentId) {
      setSrc(networkSrc);
      setIsResolving(false);
      return;
    }

    (async () => {
      const local = await resolveOfflineSrc(contentId, episodeId);
      if (cancelled) {
        if (local) URL.revokeObjectURL(local);
        return;
      }
      if (local) {
        createdUrlRef.current = local;
        setSrc(local);
        setIsOffline(true);
      } else {
        setSrc(networkSrc);
        setIsOffline(false);
      }
      setIsResolving(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [contentId, episodeId, networkSrc]);

  // Final cleanup on unmount.
  useEffect(() => {
    return () => {
      if (createdUrlRef.current) {
        URL.revokeObjectURL(createdUrlRef.current);
        createdUrlRef.current = null;
      }
    };
  }, []);

  return { src, isResolving, isOffline };
}

export default useResolvedVideoSrc;
