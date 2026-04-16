// Small Group Manager — Service Worker
const CACHE_NAME = "sgm-v6";

// On install — cache the app shell
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(["/", "/index.html"])
    )
  );
  self.skipWaiting();
});

// On activate — clean up old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fall back to cache for navigation requests
self.addEventListener("fetch", event => {
  const { request } = event;

  // Skip non-GET and API requests — always go to network for those
  if (request.method !== "GET" || request.url.includes("/api/")) return;

  // For navigation requests (page loads), serve index.html from cache as fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // For static assets — network first, cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener("push", event => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch { return; }

  const title = data.title || "Small Group Manager";
  const body  = data.body  || "You have a new message.";
  const groupId = data.groupId;

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `chat-${groupId}`,       // groups notifications per group (replaces previous)
    renotify: true,               // still vibrate/sound even if replacing same tag
    data: { groupId },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// When the user taps the notification — open the app to that group's chat tab
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const groupId = event.notification.data?.groupId;
  const url = groupId ? `/#/groups/${groupId}` : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      // If app is already open, focus it and navigate
      for (const client of windowClients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
