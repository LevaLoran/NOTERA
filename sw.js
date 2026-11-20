/**
 * NOTERA Service Worker
 * Caches only static assets. Never caches private messages or files.
 */

const CACHE_NAME = 'notera-static-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/auth.css',
  './css/responsive.css',
  './js/app.js',
  './js/supabase.js',
  './js/auth.js',
  './js/chat.js',
  './js/messages.js',
  './js/attachments.js',
  './js/search.js',
  './js/sync.js',
  './js/settings.js',
  './assets/logo.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some assets may fail on first install; ignore
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache Supabase API, storage, or auth
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/storage/') ||
    url.pathname.includes('/auth/') ||
    event.request.method !== 'GET'
  ) {
    return; // network only
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache successful same-origin GET responses for static files
        if (
          response.ok &&
          url.origin === self.location.origin &&
          (url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.svg') ||
            url.pathname.endsWith('.html') ||
            url.pathname.endsWith('.json') ||
            url.pathname.endsWith('.png'))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
