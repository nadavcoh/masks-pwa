const CACHE_NAME = 'totm-masks-__COMMIT_HASH__';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Never cache/interfere with the live Gemini API calls - always go to network for those.
  if (event.request.url.includes('generativelanguage.googleapis.com')) {
    return;
  }

  const isAppShell = event.request.mode === 'navigate' ||
    event.request.url.endsWith('manifest.json');

  if (isAppShell) {
    // Network-first: always try to get the latest page/manifest from the server.
    // Only fall back to the cached copy if the network is unavailable.
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (icons, etc.): cache-first, since it rarely changes.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (event.request.method === 'GET' && networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});

// Let a page force this worker to activate immediately (see index.html update prompt).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
