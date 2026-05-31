const PREVIEW_HOST_MARKERS = ["id-preview--", "lovable.app", "lovableproject.com"];

export function isPreviewOrIframeContext(): boolean {
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname;
  const isPreviewHost = PREVIEW_HOST_MARKERS.some((marker) => hostname.includes(marker));

  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }

  return isPreviewHost || isInIframe;
}

export async function cleanupPreviewServiceWorkers(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isPreviewOrIframeContext()) return;

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    if (registrations?.length) {
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
  } catch (error) {
    console.warn("[SWCleanup] Failed to clean preview service workers", error);
  }
}