// Service Worker for Push Notifications and PWA

const CACHE_NAME = "hoyeeh-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/",
        "/pwa-icon-192.png",
        "/pwa-icon-512.png",
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(clients.claim());
});

// Push notification handling
self.addEventListener("push", (event) => {
  console.log("Push notification received", event);

  let data = {
    title: "Hoyeeh",
    body: "You have a new notification",
    icon: "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    url: "/",
    tag: "hoyeeh-notification",
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    console.error("Error parsing push data:", e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
      contentId: data.contentId,
    },
    actions: [
      { action: "open", title: "Watch Now" },
      { action: "close", title: "Dismiss" },
    ],
    requireInteraction: true,
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked", event);
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/";
  const contentId = event.notification.data?.contentId;
  
  // If there's a content ID, go to that content
  const targetUrl = contentId ? `/content/${contentId}` : urlToOpen;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  console.log("Background sync:", event.tag);
  
  if (event.tag === "sync-watchlist") {
    event.waitUntil(syncWatchlist());
  }
});

async function syncWatchlist() {
  // Placeholder for syncing watchlist when back online
  console.log("Syncing watchlist data...");
}

// Fetch handler for offline support
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip API requests and external resources
  if (
    event.request.url.includes("/rest/v1/") ||
    event.request.url.includes("/functions/v1/") ||
    event.request.url.includes("supabase.co") ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        // Cache successful responses
        if (fetchResponse.status === 200) {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return fetchResponse;
      });
    }).catch(() => {
      // Return offline page for navigation requests
      if (event.request.mode === "navigate") {
        return caches.match(OFFLINE_URL);
      }
    })
  );
});
