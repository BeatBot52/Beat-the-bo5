const CACHE_NAME = 'beat-the-bot-v1';
const DYNAMIC_CACHE = 'beat-the-bot-dynamic-v1';

// Assets to pre-cache immediately on install
const PRE_CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  // React Dependencies
  'https://esm.sh/react@18.2.0',
  'https://esm.sh/react@18.2.0/jsx-runtime',
  'https://esm.sh/react-dom@18.2.0/client',
  'https://esm.sh/lucide-react@0.300.0',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate worker immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
            return caches.delete(cache); // Clean up old caches
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. External Assets (Fonts, Images, Scripts) -> Cache First, fall back to Network
  if (
    url.hostname.includes('esm.sh') ||
    url.hostname.includes('tailwindcss.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('flaticon.com')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors' && response.type !== 'opaque') {
              return response;
            }
            // Clone and cache
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return response;
          })
          .catch(() => {
             // Fallback for images if completely offline and not in cache
             // (Optional: could return a placeholder)
          });
      })
    );
  } 
  // 2. App Shell & Local Files -> Network First, fall back to Cache
  else {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache with new version
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  }
});