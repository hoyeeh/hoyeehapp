// Service Worker for Push Notifications, PWA, and Background Downloads
// Version is updated automatically to trigger updates
const SW_VERSION = Date.now();
const CACHE_NAME = "hoyeeh-v3";
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours max cache age
const OFFLINE_URL = "/";

// Track active background downloads
const activeBackgroundDownloads = new Map();

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

// Listen for messages from the app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("Received SKIP_WAITING message, activating new SW");
    self.skipWaiting();
  }
  
  // Handle download progress messages
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
  
  // Handle background download requests
  if (event.data && event.data.type === "START_BACKGROUND_DOWNLOAD") {
    const { downloadId, url, title, headers } = event.data.payload;
    startBackgroundDownload(downloadId, url, title, headers);
  }
  
  // Handle pause/resume/cancel for background downloads
  if (event.data && event.data.type === "PAUSE_BACKGROUND_DOWNLOAD") {
    const { downloadId } = event.data.payload;
    pauseBackgroundDownload(downloadId);
  }
  
  if (event.data && event.data.type === "RESUME_BACKGROUND_DOWNLOAD") {
    const { downloadId, url, headers } = event.data.payload;
    resumeBackgroundDownload(downloadId, url, headers);
  }
  
  if (event.data && event.data.type === "CANCEL_BACKGROUND_DOWNLOAD") {
    const { downloadId } = event.data.payload;
    cancelBackgroundDownload(downloadId);
  }
  
  // Query download status
  if (event.data && event.data.type === "GET_BACKGROUND_DOWNLOAD_STATUS") {
    const { downloadId } = event.data.payload;
    const status = activeBackgroundDownloads.get(downloadId);
    event.ports[0]?.postMessage({ downloadId, status: status || null });
  }
});

// Background download functions
async function startBackgroundDownload(downloadId, url, title, headers = {}) {
  // Check if Background Fetch API is available
  if ("backgroundFetch" in self.registration) {
    try {
      const bgFetch = await self.registration.backgroundFetch.fetch(
        downloadId,
        [new Request(url, { headers })],
        {
          title: `Downloading: ${title}`,
          icons: [{ src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" }],
          downloadTotal: 0, // Unknown total, will be updated
        }
      );
      
      activeBackgroundDownloads.set(downloadId, {
        status: "downloading",
        progress: 0,
        startedAt: Date.now(),
      });
      
      // Notify clients
      broadcastToClients({
        type: "BACKGROUND_DOWNLOAD_STARTED",
        payload: { downloadId, title }
      });
      
      return true;
    } catch (error) {
      console.error("Background Fetch failed:", error);
      // Fall back to regular download tracking
    }
  }
  
  // Fallback: Track download in service worker state
  activeBackgroundDownloads.set(downloadId, {
    status: "downloading",
    progress: 0,
    url,
    title,
    headers,
    startedAt: Date.now(),
    isPersistent: false,
  });
  
  // Notify that we're using fallback mode
  broadcastToClients({
    type: "BACKGROUND_DOWNLOAD_FALLBACK",
    payload: { downloadId, title, message: "Background Fetch not supported, download will pause if app closes" }
  });
  
  return false;
}

function pauseBackgroundDownload(downloadId) {
  const download = activeBackgroundDownloads.get(downloadId);
  if (download) {
    download.status = "paused";
    download.pausedAt = Date.now();
    activeBackgroundDownloads.set(downloadId, download);
    
    broadcastToClients({
      type: "BACKGROUND_DOWNLOAD_PAUSED",
      payload: { downloadId }
    });
  }
}

function resumeBackgroundDownload(downloadId, url, headers) {
  const download = activeBackgroundDownloads.get(downloadId);
  if (download) {
    download.status = "downloading";
    download.resumedAt = Date.now();
    if (url) download.url = url;
    if (headers) download.headers = headers;
    activeBackgroundDownloads.set(downloadId, download);
    
    broadcastToClients({
      type: "BACKGROUND_DOWNLOAD_RESUMED",
      payload: { downloadId }
    });
  }
}

function cancelBackgroundDownload(downloadId) {
  activeBackgroundDownloads.delete(downloadId);
  
  // Try to abort Background Fetch if active
  if ("backgroundFetch" in self.registration) {
    self.registration.backgroundFetch.get(downloadId).then(bgFetch => {
      if (bgFetch) bgFetch.abort();
    }).catch(() => {});
  }
  
  broadcastToClients({
    type: "BACKGROUND_DOWNLOAD_CANCELLED",
    payload: { downloadId }
  });
}

// Background Fetch event handlers
self.addEventListener("backgroundfetchsuccess", (event) => {
  const downloadId = event.registration.id;
  console.log("Background fetch success:", downloadId);
  
  event.waitUntil(
    (async () => {
      try {
        const records = await event.registration.matchAll();
        
        for (const record of records) {
          const response = await record.responseReady;
          const blob = await response.blob();
          
          // Store in Cache API temporarily (app will move to IndexedDB)
          const cache = await caches.open("hoyeeh-downloads");
          await cache.put(`/downloads/${downloadId}`, new Response(blob));
        }
        
        // Update tracking
        activeBackgroundDownloads.set(downloadId, {
          status: "completed",
          completedAt: Date.now(),
        });
        
        // Show completion notification
        await self.registration.showNotification("Download Complete", {
          body: `Your content is ready to watch offline`,
          icon: "/pwa-icon-192.png",
          badge: "/pwa-icon-192.png",
          tag: `download-complete-${downloadId}`,
          data: { downloadId, status: "completed" },
          actions: [{ action: "watch", title: "Watch Now" }],
        });
        
        // Notify clients
        broadcastToClients({
          type: "BACKGROUND_DOWNLOAD_COMPLETE",
          payload: { downloadId }
        });
        
      } catch (error) {
        console.error("Error handling background fetch success:", error);
      }
    })()
  );
});

self.addEventListener("backgroundfetchfail", (event) => {
  const downloadId = event.registration.id;
  console.log("Background fetch failed:", downloadId);
  
  activeBackgroundDownloads.set(downloadId, {
    status: "failed",
    failedAt: Date.now(),
    reason: event.registration.failureReason,
  });
  
  self.registration.showNotification("Download Failed", {
    body: "Tap to retry download",
    icon: "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    tag: `download-failed-${downloadId}`,
    data: { downloadId, status: "failed" },
    actions: [{ action: "retry", title: "Retry" }],
  });
  
  broadcastToClients({
    type: "BACKGROUND_DOWNLOAD_FAILED",
    payload: { downloadId, reason: event.registration.failureReason }
  });
});

self.addEventListener("backgroundfetchabort", (event) => {
  const downloadId = event.registration.id;
  console.log("Background fetch aborted:", downloadId);
  
  activeBackgroundDownloads.delete(downloadId);
  
  broadcastToClients({
    type: "BACKGROUND_DOWNLOAD_ABORTED",
    payload: { downloadId }
  });
});

self.addEventListener("backgroundfetchclick", (event) => {
  const downloadId = event.registration.id;
  
  event.waitUntil(
    clients.openWindow(`/downloads?highlight=${downloadId}`)
  );
});

// Helper to broadcast messages to all clients
async function broadcastToClients(message) {
  const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clientList) {
    client.postMessage(message);
  }
}

// Push notification handling - supports both visible and silent notifications
self.addEventListener("push", (event) => {
  console.log("Push notification received", event);

  let data = {
    title: "Hoyeeh",
    body: "You have a new notification",
    icon: "/pwa-icon-192.png",
    badge: "/pwa-icon-192.png",
    url: "/",
    tag: "hoyeeh-notification",
    silent: false, // If true, sync in background without showing notification
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    console.error("Error parsing push data:", e);
  }

  // Handle silent push - sync notifications in background
  if (data.silent) {
    console.log("Silent push - syncing notifications in background");
    event.waitUntil(
      (async () => {
        // Notify all open clients to refresh their notification data
        await broadcastToClients({
          type: "SYNC_NOTIFICATIONS",
          payload: { timestamp: Date.now() }
        });
        
        // If no clients are open, we can still cache the notification for later
        const clientList = await clients.matchAll({ type: "window" });
        if (clientList.length === 0) {
          console.log("No clients open - notification will sync when app opens");
        }
      })()
    );
    return;
  }

  // Visible notification
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
  const downloadId = event.notification.data?.downloadId;
  const status = event.notification.data?.status;
  
  // Handle download notification actions
  if (event.action === "watch" && (contentId || downloadId)) {
    const targetUrl = contentId ? `/content/${contentId}` : `/downloads?play=${downloadId}`;
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
  
  if (event.action === "retry" && downloadId) {
    // Notify app to retry download
    broadcastToClients({
      type: "RETRY_DOWNLOAD",
      payload: { downloadId }
    });
    
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow("/downloads");
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
  
  if (event.tag.startsWith("sync-download-")) {
    const downloadId = event.tag.replace("sync-download-", "");
    event.waitUntil(syncDownload(downloadId));
  }
  
  // Handle offline action sync
  if (event.tag === "sync-offline-actions") {
    event.waitUntil(syncOfflineActions());
  }
});

// Sync offline actions queued by the app
async function syncOfflineActions() {
  console.log("Syncing offline actions...");
  // Notify clients to process their queued actions
  await broadcastToClients({
    type: "PROCESS_OFFLINE_QUEUE",
    payload: { timestamp: Date.now() }
  });
}

async function syncWatchlist() {
  console.log("Syncing watchlist data...");
}

async function syncDownload(downloadId) {
  console.log("Syncing download:", downloadId);
  // Resume paused downloads when back online
  const download = activeBackgroundDownloads.get(downloadId);
  if (download && download.status === "paused" && download.url) {
    resumeBackgroundDownload(downloadId, download.url, download.headers);
  }
}

// Periodic sync for download status checks (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-downloads") {
    event.waitUntil(checkPendingDownloads());
  }
});

async function checkPendingDownloads() {
  // Check for any paused downloads that can be resumed
  for (const [downloadId, download] of activeBackgroundDownloads) {
    if (download.status === "paused" && navigator.onLine) {
      broadcastToClients({
        type: "DOWNLOAD_READY_TO_RESUME",
        payload: { downloadId }
      });
    }
  }
}

// Fetch handler for offline support
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Handle requests for downloaded content
  if (event.request.url.includes("/downloads/")) {
    event.respondWith(
      caches.match(event.request, { cacheName: "hoyeeh-downloads" }).then(response => {
        if (response) return response;
        return new Response("Download not found", { status: 404 });
      })
    );
    return;
  }

  // Skip API requests and external resources
  if (
    event.request.url.includes("/rest/v1/") ||
    event.request.url.includes("/functions/v1/") ||
    event.request.url.includes("supabase.co") ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  // NetworkFirst strategy - always try network, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful GET responses
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // Add timestamp header for cache age tracking
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Network failed - try cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (event.request.mode === "navigate") {
          return caches.match(OFFLINE_URL);
        }
        
        // Return error for other requests
        return new Response("Network error", { status: 503 });
      })
  );
});

// Cleanup old cache entries periodically
async function cleanupOldCacheEntries() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const now = Date.now();
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const cacheTime = new Date(dateHeader).getTime();
          if (now - cacheTime > CACHE_MAX_AGE) {
            await cache.delete(request);
            console.log('Cleaned old cache entry:', request.url);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Cache cleanup failed:', e);
  }
}

// Run cleanup on activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      cleanupOldCacheEntries(),
      // Also clean up during periodic activation
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && !cacheName.includes('download')) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      clients.claim()
    ])
  );
});