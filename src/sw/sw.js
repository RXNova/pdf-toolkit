// Service worker: makes PDF Toolkit work fully offline once it has been opened.
// The build fills in VERSION and PRECACHE (every file the app needs; see vite.config.mjs).
// It never sees your PDFs: those stay in the page and its worker and are never fetched.
const VERSION = '__VERSION__';
const PRECACHE = /** @type {string[]} */ (__PRECACHE__);
const CACHE = `pdfkit-${VERSION}`;
// Responses were cached without an Origin header; module scripts send one. Match on URL alone.
const MATCH = { cacheName: CACHE, ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

// Drop caches from older versions, and take over open tabs straight away.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pdfkit-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // The page: fresh from the network when online (picks up new deploys), cached when offline.
    event.respondWith(fetch(request).catch(() => caches.match('./', MATCH)));
    return;
  }
  // Everything else is versioned by the build: cache first.
  event.respondWith(caches.match(request, MATCH).then((hit) => hit ?? fetch(request)));
});
