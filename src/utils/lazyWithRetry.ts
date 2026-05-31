import { lazy, ComponentType } from "react";

const RELOAD_KEY = "lovable_chunk_reload_attempt";

/**
 * Wrap React.lazy so that a failed dynamic import (typically a stale chunk
 * after a new deploy) triggers a one-time hard reload to fetch the new
 * index.html and chunk filenames. Prevents permanent blank screens.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      // Successful load — clear any prior reload marker
      try {
        window.sessionStorage.removeItem(RELOAD_KEY);
      } catch {}
      return mod;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isChunkError =
        /Importing a module script failed/i.test(message) ||
        /Failed to fetch dynamically imported module/i.test(message) ||
        /error loading dynamically imported module/i.test(message) ||
        /ChunkLoadError/i.test(message);

      if (isChunkError && typeof window !== "undefined") {
        let alreadyTried = false;
        try {
          alreadyTried = window.sessionStorage.getItem(RELOAD_KEY) === "1";
        } catch {}

        if (!alreadyTried) {
          try {
            window.sessionStorage.setItem(RELOAD_KEY, "1");
          } catch {}
          window.location.reload();
          // Return a never-resolving promise so Suspense holds while reload happens
          return new Promise(() => {}) as Promise<{ default: T }>;
        }
      }
      throw err;
    }
  });
}
