// Small Group Manager — Service Worker
const CACHE_NAME = "sgm-v4";

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
