import { useEffect, useState } from "react";

/**
 * Phase 2 feature flag for the new Video.js-based player.
 *
 * Enabled when EITHER:
 *  - the URL contains `?player=vjs` (one-shot, also persisted to localStorage)
 *  - localStorage has `player=vjs` (persistent QA toggle)
 *
 * Disable by visiting `?player=legacy` or clearing the `player` localStorage key.
 *
 * IMPORTANT: This is a non-default opt-in. The legacy <VideoPlayer /> remains
 * the default for all live users. Do not flip the default here.
 */
const STORAGE_KEY = "player";

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const qp = params.get("player");
    if (qp === "vjs") {
      try { window.localStorage.setItem(STORAGE_KEY, "vjs"); } catch {}
      return true;
    }
    if (qp === "legacy") {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch {}
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) === "vjs";
  } catch {
    return false;
  }
}

export function useNewPlayer(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => readFlag());

  useEffect(() => {
    // Re-evaluate on route changes within SPA navigation.
    const onPop = () => setEnabled(readFlag());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return enabled;
}

/** Static check for non-hook contexts. */
export function isNewPlayerEnabled(): boolean {
  return readFlag();
}
