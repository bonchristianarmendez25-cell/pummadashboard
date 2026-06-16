const CACHE_NAME = 'pumma-dashboard-v2'; // Change to v3, v4, etc., on future updates

// These are the files your app will save to the device so it loads instantly
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './pumma_patch_apply.js',
  './MOCKBOAT LOGO.png'
];

// Install the Service Worker and cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercept web requests and serve cached files if offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return the cached file if found, otherwise fetch from the internet
        return response || fetch(event.request);
      })
  );
});
