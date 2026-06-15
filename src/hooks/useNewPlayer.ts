import { useEffect, useState } from "react";

/**
 * Player flag.
 *
 * Phase 2/3 (opt-in flag) — `useNewPlayer()`:
 *   Enabled only when `?player=vjs` is on URL or localStorage has `player=vjs`.
 *   Used by surfaces still being validated (trailers, modal previews, spotlight).
 *
 * Phase 4 (default-on for free content) — `useNewPlayerForFree()`:
 *   Returns TRUE by default for free / non-DRM / non-paid content. The legacy
 *   player is only used if the caller's own guards trip (premium/DRM/paid) OR
 *   the user has explicitly forced legacy via `?player=legacy` (also persisted
 *   to localStorage as a kill-switch).
 *
 * Disable opt-in or force legacy by visiting `?player=legacy`.
 * Clear the `player` localStorage key to reset.
 */
const STORAGE_KEY = "player";

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const qp = params.get("player");
    if (qp === "vjs") {
      try { window.localStorage.setItem(STORAGE_KEY, "vjs"); } catch {}
      return "vjs";
    }
    if (qp === "legacy") {
      try { window.localStorage.setItem(STORAGE_KEY, "legacy"); } catch {}
      return "legacy";
    }
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readOptInFlag(): boolean {
  return readStored() === "vjs";
}

function readForceLegacy(): boolean {
  return readStored() === "legacy";
}

export function useNewPlayer(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => readOptInFlag());

  useEffect(() => {
    const onPop = () => setEnabled(readOptInFlag());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return enabled;
}

/**
 * Phase 4 — VideoJSPlayer is the DEFAULT for free / non-DRM / non-paid surfaces.
 * Returns true unless the user has explicitly forced `?player=legacy`.
 * Callers MUST still gate premium/DRM/paid content themselves.
 */
export function useNewPlayerForFree(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => !readForceLegacy());

  useEffect(() => {
    const onPop = () => setEnabled(!readForceLegacy());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return enabled;
}

/** Static check for non-hook contexts. */
export function isNewPlayerEnabled(): boolean {
  return readOptInFlag();
}

export function isLegacyPlayerForced(): boolean {
  return readForceLegacy();
}
