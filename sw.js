// Clarity Service Worker – network-first so normal refresh / pull-to-refresh gets updates
const CACHE_NAME = 'clarity-v6';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './logo.jpg'
];

// Install: pre-cache the app shell, then activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches and take control of open pages right away
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  // App shell files that should always try the network first
  const isAppShell =
    path.endsWith('/') ||
    path.endsWith('/index.html') ||
    path.endsWith('/app.js') ||
    path.endsWith('/styles.css') ||
    path.endsWith('/manifest.json') ||
    path.endsWith('/sw.js');

  if (isAppShell) {
    // Network-first → a normal refresh / pull-to-refresh gets the newest version
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkRes;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
  } else {
    // Images and other static assets: cache-first (faster, still works offline)
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkRes;
        });
      })
    );
  }
});
