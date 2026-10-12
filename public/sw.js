/**
 * Velo.LHR - Service Worker
 * Handles offline caching, auto-updates, and version checking.
 */

const CACHE_VERSION = 'velo-lhr-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/db.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const DATA_ASSETS = [
  '/data/hotels.json',
  '/data/version.json'
];

/* ============ INSTALL ============ */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(DATA_CACHE).then((cache) => {
        console.log('[SW] Caching data assets');
        return cache.addAll(DATA_ASSETS);
      })
    ]).then(() => self.skipWaiting())
  );
});

/* ============ ACTIVATE ============ */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

/* ============ FETCH ============ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Data files: network-first, fallback to cache
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirstData(request));
    return;
  }

  // HTML: network-first
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // Static assets: cache-first
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

async function networkFirstData(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fallback to index.html for navigation
    if (request.headers.get('accept')?.includes('text/html')) {
      return cache.match('/index.html');
    }
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    throw err;
  }
}

/* ============ VERSION CHECK MESSAGE ============ */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CHECK_VERSION') {
    checkVersionAndUpdate();
  }
});

async function checkVersionAndUpdate() {
  try {
    const response = await fetch('/data/version.json?t=' + Date.now());
    if (!response.ok) return;

    const cloudVersion = await response.json();
    const cache = await caches.open(DATA_CACHE);
    const cachedVersionRes = await cache.match('/data/version.json');

    let localVersion = null;
    if (cachedVersionRes) {
      localVersion = await cachedVersionRes.json();
    }

    if (!localVersion || localVersion.checksum !== cloudVersion.checksum) {
      console.log('[SW] New version detected:', cloudVersion.version);
      // Refresh data cache
      const hotelsRes = await fetch('/data/hotels.json?t=' + Date.now());
      if (hotelsRes.ok) {
        await cache.put('/data/hotels.json', hotelsRes.clone());
      }
      await cache.put('/data/version.json', new Response(JSON.stringify(cloudVersion), {
        headers: { 'Content-Type': 'application/json' }
      }));

      // Notify all clients
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: 'DATA_UPDATED',
          version: cloudVersion.version
        });
      });
    }
  } catch (err) {
    console.warn('[SW] Version check failed:', err);
  }
}

/* ============ PERIODIC SYNC ============ */
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-version') {
    event.waitUntil(checkVersionAndUpdate());
  }
});