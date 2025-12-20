// Service Worker for Push Notifications and PWA
// Version is updated automatically to trigger updates
const SW_VERSION = Date.now();
const CACHE_NAME = "hoyeeh-v2";
const OFFLINE_URL = "/";

// Force immediate activation for updates
self.addEventListener("install", (event) => {
  console.log("Service Worker installing, version:", SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/",
        "/pwa-icon-192.png",
        "/pwa-icon-512.png",
      ]);
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating, version:", SW_VERSION);
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      clients.claim()
    ])
  );
});

// Listen for skip waiting message from the app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("Received SKIP_WAITING message, activating new SW");
    self.skipWaiting();
  }
  
  // Handle download progress messages (existing functionality)
  if (event.data && event.data.type === "DOWNLOAD_PROGRESS") {
    const { contentId, title, progress, status } = event.data.payload;
    
    if (status === "completed" || status === "failed") {
      const notificationTitle = status === "completed" 
        ? "Download Complete" 
        : "Download Failed";
      const body = status === "completed"
        ? `${title} is ready to watch offline`
        : `Failed to download ${title}`;
      
      self.registration.showNotification(notificationTitle, {
        body,
        icon: "/pwa-icon-192.png",
        badge: "/pwa-icon-192.png",
        tag: `download-${contentId}`,
        renotify: true,
        requireInteraction: status === "failed",
        actions: status === "completed" 
          ? [{ action: "watch", title: "Watch Now" }]
          : [{ action: "retry", title: "Retry" }],
        data: { contentId, status },
      });
    }
  }
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
  const status = event.notification.data?.status;
  
  // Handle download notification actions
  if (event.action === "watch" && contentId) {
    const targetUrl = `/content/${contentId}`;
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
    return;
  }
  
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